import {
  diff_match_patch as DiffMatchPatch,
  DIFF_DELETE,
  DIFF_INSERT
} from "diff-match-patch"
import fetch from "node-fetch"
import { promises as fs } from "fs"
import express from "express"
import SocketIo from "socket.io"
import http from "http"

const dmp = new DiffMatchPatch()

export class Revision {
  public text: string | undefined
  public id: string
  public author: string | undefined
  public comment: string | undefined

  //True if some of the text attributed to this rev may in fact be from a revdel'd version
  public includesRevdel: boolean = false

  constructor(rev: any) {
    this.text = rev.slots.main["*"]
    this.id = rev.revid
    this.author = rev.user
    this.comment = rev.comment
  }

  hasText(): this is KnownRev {
    return !!this.text
  }

  toJson() {
    return {
      id: this.id,
      author: this.author,
      comment: this.comment,
      includesRevdel: this.includesRevdel
    }
  }
}

let lastChunkId = 0

class Chunk {
  added: Revision | null
  removed: Revision | null
  text: string
  id: number

  constructor(text: string) {
    this.text = text
    this.added = null
    this.removed = null
    this.id = ++lastChunkId
  }

  split(idx: number) {
    const chunk1 = new Chunk(this.text.substring(0, idx))
    const chunk2 = new Chunk(this.text.substring(idx))
    ;[chunk1, chunk2].forEach(c => {
      c.added = this.added
      c.removed = this.removed
    })

    return [chunk1, chunk2]
  }

  toJson() {
    return {
      text: this.text,
      added: this.added && this.added.toJson(),
      removed: this.removed && this.removed.toJson(),
      id: this.id
    }
  }
}

type KnownRev = Revision & { text: string }

export class Article {
  title: string
  chunks: Chunk[]
  earliestRev: KnownRev
  latestRev: KnownRev

  constructor(title: string, rev: Revision) {
    if (!rev.hasText()) {
      throw new Error("What? Latest rev was revdel'd")
    }
    this.chunks = [new Chunk(rev.text)]
    this.latestRev = rev
    this.earliestRev = rev
    this.title = title
  }

  addRevisionBefore(revision: Revision) {
    if (!revision.hasText()) {
      // Revdel'd.
      this.earliestRev.includesRevdel = true
      return
    }

    let diff = dmp.diff_main(revision.text, this.earliestRev.text)
    dmp.diff_cleanupSemantic(diff)
    console.log("diff done")

    let diffChunkId = 0
    let articleChunkId = 0

    while (true) {
      const diffChunk = diff[diffChunkId]
      const articleChunk = this.chunks[articleChunkId]

      if (diffChunk && diffChunk[1] == "") {
        // Empty chunk. Ignore it.
        diffChunkId++
        continue
      }

      if (diffChunk && diffChunk[0] == DIFF_DELETE) {
        // This is the revision where this chunk gets removed. Let's add an
        // article chunk for it, so that when adding earlier chunks we can match up.

        const chunk = new Chunk(diffChunk[1])
        chunk.removed = revision

        this.chunks.splice(articleChunkId, 0, chunk)

        diffChunkId++
        articleChunkId++

        continue
      }

      if (articleChunk && articleChunk.added) {
        // If we know when the chunk was added, it's already gone and we
        // don't care about it.
        articleChunkId++
        continue
      }

      if (!diffChunk || !articleChunk) {
        if (diffChunk || articleChunk) {
          throw new Error("length mismatch")
        }

        break
      }

      if (diffChunk[1].length < articleChunk.text.length) {
        // We need to split the article chunk.

        this.chunks.splice(
          articleChunkId,
          1,
          ...articleChunk.split(diffChunk[1].length)
        )

        continue
      }

      if (diffChunk[1].length > articleChunk.text.length) {
        // We need to split the diff chunk.

        diff.splice(
          diffChunkId,
          1,
          [diffChunk[0], diffChunk[1].substring(0, articleChunk.text.length)],
          [diffChunk[0], diffChunk[1].substring(articleChunk.text.length)]
        )

        continue
      }

      if (diffChunk[1] != articleChunk.text) {
        throw new Error(
          `wat, mismatch :((( ${diffChunk[1]} ${articleChunk.text}`
        )
      }

      // OK, we've got two matching chunks.

      if (diffChunk[0] == DIFF_INSERT) {
        // This is where this chunk was added.
        articleChunk.added = this.earliestRev
      }

      diffChunkId++
      articleChunkId++
    }

    this.earliestRev = revision
  }

  stats() {
    const stats: Record<string, number> = {}

    this.chunks.forEach(chunk => {
      if (!chunk.removed) {
        const author = (chunk.added && chunk.added.author) || "unknown"
        stats[author] = stats[author] || 0
        stats[author] += chunk.text.length
      }
    })

    return stats
  }

  toJson() {
    return {
      chunks: this.chunks
        .filter(chunk => !chunk.removed)
        .map(chunk => chunk.toJson()),
      stats: this.stats(),
      title: this.title
    }
  }
}

async function run(title: string, client: SocketIo.Socket) {
  try {
    let rvcontinue: string | null = null
    let art: Article | null = null
    while (true) {
      const url: string = `https://en.wikipedia.org/w/api.php?action=query&prop=revisions&titles=${encodeURIComponent(
        title
      )}&rvlimit=50&rvprop=timestamp%7Cuser%7Ccomment%7Cids|contentmodel|content&rvslots=main&format=json${
        rvcontinue ? "&rvcontinue=" + rvcontinue : ""
      }`
      const res = await fetch(url, {
        headers: { "User-Agent": "User:Gaelan testing some stuff." }
      })
      const json = await res.json()
      const pages = json.query.pages
      const pageId = Object.keys(pages)[0]
      let earlierRevs: any[] = []
      if (!art) {
        let firstRev
        ;[firstRev, ...earlierRevs] = pages[pageId].revisions
        art = new Article(title, new Revision(firstRev))
      } else {
        earlierRevs = pages[pageId].revisions
      }
      earlierRevs.forEach((rev: any, idx) => {
        const revObj = new Revision(rev)
        console.log(
          `handling rev ${revObj.id} ${revObj.comment} by ${revObj.author}`
        )
        art!.addRevisionBefore(revObj)
        const stats = art!.stats()
        console.log(
          Object.keys(stats)
            .map(user => `${user}: ${stats[user]}`)
            .join(", ")
        )
      })
      client.emit("update", art.toJson())
      if (!art.stats()["unknown"]) {
        break
      }
      if (json.continue) {
        rvcontinue = json.continue.rvcontinue
      } else {
        break
      }
      if (!client.connected) {
        break
      }
    }
  } catch (e) {
    console.error(e)
    process.exit(1)
  }
}

const app = express()
const server = new http.Server(app)
const io = SocketIo(server)

app.use(express.static("whodunnit-client/build"))

io.on("connection", client => {
  client.on("requestArticle", message => {
    run(message.article, client)
  })
})

server.listen(process.env.PORT, () =>
  console.log(`Listening on port ${process.env.PORT}`)
)
