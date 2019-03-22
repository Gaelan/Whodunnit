workflow "Update the thing" {
  on = "push"
  resolves = ["ssh"]
}

action "ssh" {
  uses = "maddox/actions/ssh@master"
  secrets = ["HOST", "USER", "PUBLIC_KEY", "PRIVATE_KEY"]
  args = "become whodunnit ~/update.sh"
}
