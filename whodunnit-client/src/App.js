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

function Chunk({
  chunk,
  mouseEnter,
  mouseLeave,
  hovered,
  selected,
  onClick,
  dim
}) {
  const classes = []
  classes.push("chunk")
  if (chunk.added) {
    classes.push("known")
  }
  if (hovered) {
    classes.push("hovered")
  }
  if (selected) {
    classes.push("selected")
  }
  if (dim) {
    classes.push("dim")
  }
  return (
    <span
      className={classes.join(" ")}
      onMouseEnter={mouseEnter}
      onMouseLeave={mouseLeave}
      onClick={onClick}
      style={{
        backgroundColor: chunk.added && colorForUser(chunk.added.author)
      }}
    >
      {chunk.text}
    </span>
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

    this.state = { hoveredRev: null, selectedRev: null, selectedUser: null }
  }

  activeRev() {
    return this.state.hoveredRev || this.state.selectedRev
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
              mouseEnter={() => this.setState({ hoveredRev: chunk.added })}
              mouseLeave={() => {
                if (
                  this.state.hoveredRev &&
                  chunk.added &&
                  this.state.hoveredRev.id == chunk.added.id
                ) {
                  this.setState({ hoveredRev: null })
                }
              }}
              onClick={() => this.setState({ selectedRev: chunk.added })}
              hovered={
                this.state.hoveredRev &&
                chunk.added &&
                this.state.hoveredRev.id == chunk.added.id
              }
              selected={
                this.state.selectedRev &&
                chunk.added &&
                this.state.selectedRev.id == chunk.added.id
              }
              dim={
                this.state.selectedUser &&
                (!chunk.added || this.state.selectedUser != chunk.added.author)
              }
            />
          ))}
        </pre>
        <div class="sidebar">
          <div id="currentRev">
            {this.activeRev() && (
              <div>
                <p>
                  <b
                    style={{
                      backgroundColor: colorForUser(this.activeRev().author)
                    }}
                    className="author"
                    onClick={() => {
                      if (this.state.selectedUser != this.activeRev().author) {
                        this.setState({
                          selectedUser: this.activeRev().author
                        })
                      } else {
                        this.setState({ selectedUser: null })
                      }
                    }}
                  >
                    {this.activeRev().author}
                  </b>
                </p>
                <p>{this.activeRev().comment}</p>
                <p>
                  <a
                    href={
                      this.activeRev() &&
                      `https://en.wikipedia.org/w/index.php?oldid=${
                        this.activeRev().parentid
                      }&diff=${this.activeRev().id}`
                    }
                    target="_blank"
                    rel="noopener"
                  >
                    {new Date(this.activeRev().timestamp).toLocaleString()}{" "}
                    (local time)
                  </a>
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
