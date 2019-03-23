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

function ColorKey({ stats, selectUser }) {
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
        <li key={name}>
          <span
            className="colorExample"
            style={{ backgroundColor: colorForUser(name) }}
            onClick={() => selectUser(name)}
          >
            {name} ({Math.round((stats[name] / total) * 100)}%)
          </span>
        </li>
      ))}
    </ul>
  )
}

function RevisionDetail({ revision, selectUser }) {
  return (
    <div id="currentRev">
      {revision && (
        <div>
          <p>
            <b
              style={{
                backgroundColor: colorForUser(revision.author)
              }}
              className="author"
              onClick={() => selectUser()}
            >
              {revision.author}
            </b>
          </p>

          <p>{revision.comment}</p>

          <p>
            <a
              href={
                revision &&
                `https://en.wikipedia.org/w/index.php?oldid=${
                  revision.parentid
                }&diff=${revision.id}`
              }
              target="_blank"
              rel="noopener noreferrer"
            >
              {new Date(revision.timestamp).toLocaleString()} (local time)
            </a>
          </p>
        </div>
      )}
    </div>
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

  selectUser(name) {
    if (this.state.selectedUser != name) {
      this.setState({
        selectedUser: name
      })
    } else {
      this.setState({ selectedUser: null })
    }
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
      <div className="flex">
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
        <div className="sidebar">
          <div id="currentRev">
            <RevisionDetail
              revision={this.activeRev()}
              selectUser={() => this.selectUser(this.activeRev().author)}
            />
          </div>
          {this.state.article && (
            <ColorKey
              stats={this.state.article.stats}
              selectUser={name => this.selectUser(name)}
            />
          )}
        </div>
      </div>
    )
  }
}

export default App
