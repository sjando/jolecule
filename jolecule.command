DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd $DIR
python jolecule.py -i
if [ "$(uname)" == "Darwin" ]; then
  echo -n -e "]0;jolecule"
  osascript -e 'tell application "Terminal" to close (every window whose name contains "jolecule")' &
fi
