#!/bin/zsh
# Node CLI wrapper — loads nvm, then invokes the TypeScript entry via tsx.
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
exec npx --prefix "$(dirname "$0")/js" tsx "$(dirname "$0")/js/src/cli.ts" "$@"
