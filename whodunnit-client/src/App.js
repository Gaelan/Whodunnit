import React, { Component } from "react"
import "./App.css"
import io from "socket.io-client"

const socket = io({ path: "/whodunnit/socket.io" })

function Chunk({ chunk, mouseEnter, mouseLeave, highlight, colorId }) {
  const classes = []
  classes.push("chunk")
  if (chunk.added) {
    classes.push("known")
  }
  if (colorId) {
    classes.push("color-code-" + colorId)
  }
  if (highlight) {
    classes.push("highlight")
  }
  return (
    <span
      className={classes.join(" ")}
      onMouseEnter={mouseEnter}
      onMouseLeave={mouseLeave}
    >
      {chunk.text}
    </span>
  )
}

function ColorKey({ scheme }) {
  return (
    <ul id="colorKey">
      {scheme.map((name, index) => (
        <li className={"colorExample color-code-" + (index + 1)}>{name}</li>
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
        this.setState({ article: art, colorScheme: names.slice(0, 19) })
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
              colorId={
                chunk.added &&
                this.state.colorScheme &&
                this.state.colorScheme.indexOf(chunk.added.author) + 1
              }
            />
          ))}
        </pre>
        <div class="sidebar">
          <div id="currentRev">
            {this.state.hoveredRev && (
              <div>
                <p>{this.state.hoveredRev.author}</p>
                <p>{this.state.hoveredRev.comment}</p>
              </div>
            )}
          </div>
          {this.state.colorScheme && (
            <ColorKey scheme={this.state.colorScheme} />
          )}
        </div>
      </div>
    )
  }
}

export default App
