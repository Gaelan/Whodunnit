workflow "Update the thing" {
  on = "push"
  resolves = ["ssh"]
}

action "ssh" {
  uses = "maddox/actions/ssh@master"
  secrets = [
    "USER",
    "PUBLIC_KEY",
    "PRIVATE_KEY",
    "HOST",
  ]
  args = "become whodunnit jsub -mem 4g -j y -stderr -m beas -M gbs@canishe.com update.sh"
}
