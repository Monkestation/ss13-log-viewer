
# [SS13 Web JSON Log/Runtime viewer](https://monkestation.github.io/ss13-log-viewer/)

A React log viewer for TG's style of SS13 logs, primarily oriented around runtimes, based on the in-game runtime viewer.

![A preview showing the log viewer](preview.gif)

- Supports Organized/Linear viewing; ignore non-runtimes (lots of sorting options, just uhh look at the thing.)
- Support for hash params:
- - `organized`, `sort_logs`, `sort_ascending`, `ignore_non_runtimes`, `search_use_regex`
- Support for search via hash param `search`
- Support for raw logs via hash param `log_text`, and file name title `log_name`
- yah dats pretty much it rn

## key handling:
space - search box
arrow keys (only in runtimes) - navigate between runtimes

## TODO: 
- [x] Add a search function
- [ ] Add pagination probably
- [ ] Try parsing other kinds of logs, not just runtimes.
- [ ] Parse first line of log properly.
- [ ] Allow arrow keys in organized menu
- [ ] Add key combinations for copying and stuff
- - Hold shift or alt to show keys for buttons.
- [ ] Add "case sensitive" option for regexs
- [ ] Order should be: In order -> Alphabetically -> Most occurances (if in organized/group mode)

## HEY FAT DISCLAIMER!!!!

**DO NOT DO THE PRACTICES IN THIS REPO**
DO NOT USE BABEL STANDALONE
DO NOT UPLOAD LIBS DIRECTLY TO THE REPO
DO NOT DO ANYTHING THAT COMPILES AT BROWSE-TIME
HOLY FUCK JUST USE A BUNDLER
THE ONLY REASON I DID THIS IS BECAUSE I AM EXTREMELY GOD DAMN LAZY AND I DONT WANT TO LEARN HOW GITHUB PAGES WORKS TO COMPILE AND DO ALL THAT BUNDLER SHIT

# LICENSE

This project is licensed under the [MIT license](LICENSE.md)