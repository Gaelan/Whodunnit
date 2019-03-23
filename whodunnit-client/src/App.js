import React, { Component } from "react"
import "./App.css"
import io from "socket.io-client"
import randomColor from "randomcolor"

const socket = io({ path: "/whodunnit/socket.io" })

function colorForUser(username) {
  return randomColor({
    seed: username,
    luminosity: "light"
  })
}

function Chunk({ chunk, mouseEnter, mouseLeave, highlight }) {
  const classes = []
  classes.push("chunk")
  if (chunk.added) {
    classes.push("known")
  }
  if (highlight) {
    classes.push("highlight")
  }
  return (
    <a
      className={classes.join(" ")}
      onMouseEnter={mouseEnter}
      onMouseLeave={mouseLeave}
      style={{
        backgroundColor: chunk.added && colorForUser(chunk.added.author)
      }}
      href={
        chunk.added &&
        `https://en.wikipedia.org/w/index.php?oldid=${
          chunk.added.parentid
        }&diff=${chunk.added.id}`
      }
      target="_blank"
      rel="noopener"
    >
      {chunk.text}
    </a>
  )
}

function ColorKey({ stats }) {
  const names = Object.keys(stats)
    .filter(x => x != "unknown")
    .sort((a, b) => stats[b] - stats[a])
    .slice(0, 20)
  const total = Object.keys(stats)
    .map(x => stats[x])
    .reduce((a, b) => a + b)
  return (
    <ul id="colorKey">
      {names.map(name => (
        <li>
          <span
            className="colorExample"
            style={{ backgroundColor: colorForUser(name) }}
          >
            {name} ({Math.round((stats[name] / total) * 100)}%)
          </span>
        </li>
      ))}
    </ul>
  )
}

class App extends Component {
  constructor(props) {
    super(props)

    this.state = { hoveredRev: null }
  }

  componentDidMount() {
    const title = prompt("Enter article name")

    socket.emit("requestArticle", { article: title })

    socket.on("update", art => {
      if (art.title == title) {
        const names = Object.keys(art.stats)
          .filter(x => x != "unknown")
          .sort((a, b) => art.stats[b] - art.stats[a])
        this.setState({ article: art })
      }
    })
  }

  render() {
    if (!this.state.article) {
      return <div>Loading</div>
    }
    return (
      <div class="flex">
        <pre className="code">
          {this.state.article.chunks.map(chunk => (
            <Chunk
              key={chunk.id}
              chunk={chunk}
              mouseEnter={() => {
                console.log("enter", chunk.added)
                this.setState({ hoveredRev: chunk.added })
              }}
              mouseLeave={() => {
                if (
                  this.state.hoveredRev &&
                  chunk.added &&
                  this.state.hoveredRev.id == chunk.added.id
                ) {
                  this.setState({ hoveredRev: null })
                }
              }}
              highlight={
                this.state.hoveredRev &&
                this.state.hoveredRev.id == (chunk.added && chunk.added.id)
              }
            />
          ))}
        </pre>
        <div class="sidebar">
          <div id="currentRev">
            {this.state.hoveredRev && (
              <div>
                <p>
                  <b>{this.state.hoveredRev.author}</b>
                </p>
                <p>{this.state.hoveredRev.comment}</p>
                <p>
                  {new Date(this.state.hoveredRev.timestamp).toLocaleString()}{" "}
                  (local time)
                </p>
              </div>
            )}
          </div>
          {this.state.article && <ColorKey stats={this.state.article.stats} />}
        </div>
      </div>
    )
  }
}

export default App
