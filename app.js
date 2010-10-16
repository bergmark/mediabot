var IRC = require('./IRC-js/lib/irc');
var joose = require("Joose");
var spawn = require('child_process').spawn;
var fs = require('fs');
var http = require('http');
var sys = require('sys');
var IrcWrapper = require('./lib/IrcWrapper');

// CACTUS INCLUDES
Function.prototype.bind = function (scope, arg1) {
    var args = Array.prototype.slice.call(arguments, 1);
    var func = this;
    return function () {
        return Function.prototype.apply.call(
            func,
            scope === null ? this : scope,
            args.concat(Array.prototype.slice.call(arguments)));
    };
};

Function.prototype.curry = Function.prototype.bind.bind(null, null);
// END CACTUS

var musicDest = "/Users/adam/musi/downloaded/";

var runCmd = function (cmd, args, callback) {
    var s = spawn(cmd, args);
    var contents = "";
    s.stdout.on('data', function (data) {
        contents += data;
    });
    s.stdout.on('end', function () {
        if (callback instanceof Function) {
            callback(contents);
        }
    });
};

function parseAppleScriptTracks(str) {
    var h = [];
    var tracks = str.split('@!@');
    tracks.pop();
    for (var i = 0; i < tracks.length; i++) {
        var t = tracks[i].split('!!@!!');
        h.push({
            name : t[0],
            path : t[1]
        });
    }
    return h;
}

var itunes = {
    play : runCmd.curry('osascript', ['-e', 'tell app "iTunes" to play']),
    pause : runCmd.curry('osascript', ['-e', 'tell app "iTunes" to pause']),
    setVolume : function (vol) {
        runCmd('osascript', ['-e', 'tell app "iTunes" to set sound volume to ' + vol]);
    },
    playSong : function (filePath, callback) {
        runCmd('open', ['-a', '/Applications/iTunes.app', filePath], callback);
    },
    queueSong : function (query, index, callback) {
        runCmd('itunes-queue', [query, index], callback);
    },
    whatsPlaying : runCmd.curry('itunes-whatsplaying', undefined),
    search : function (query, callback) {
        runCmd('itunes-search', [query], callback);
    },
    queueGet : runCmd.curry('itunes-queue-get', null),
    currentPosInPlaylist : function (callback) {
        runCmd('itunes-current-pos-in-playlist', null, function (contents) {
            callback(contents === "" ? 1 : parseInt(contents, 10));
        });
    },
    lengthOfPlaylist : function (callback) {
        runCmd('itunes-length-of-playlist', null, function (contents) {
            callback(parseInt(contents, 10));
        })
    },
    playerState : runCmd.curry('itunes-player-state', null)
};

var currentSearchPaths = [];

var ircWrapper = new IrcWrapper({
    IRC : IRC,
    server : "irc.vassius.se",
    nick : "mediabot2",
    joinChannels : ["#c-test"],
    bindings : {
        privmsg : [{
            messageString : "play",
            callback : itunes.play
        }, {
            messageString : "pause",
            callback : itunes.pause
        }, {
            messageString : "quit",
            callback : itunes.quit
        }, {
            messageRegExp : /^volume (\d+)/,
            callback : function (h) {
                var vol = Math.min(100, parseInt(h.regExp[1], 10));
                itunes.setVolume(vol);
                h.reply("Volume set to " + vol);
            }
        }, {
            messageRegExp : /^queue (\d+)/,
            callback : function (h) {
                var trackNo = parseInt(h.regExp[1], 10);
                if (trackNo in currentSearchPaths) {
                    itunes.queueSong(currentSearchPaths.query, trackNo + 1, function () {
                        itunes.currentPosInPlaylist(function (curPos) {
                            itunes.lengthOfPlaylist(function (lengthOfPlaylist) {
                                var queuePos = lengthOfPlaylist - curPos + 1;
                                h.reply("Queued " + currentSearchPaths[trackNo].trackName + " in position " + queuePos);
                            });
                        });
                    });
                } else {
                    h.reply("No such index.");
                }
            }
        }, {
            messageRegExp : /^play (\d+)/,
            callback : function (h) {
                var trackNo = parseInt(h.regExp[1], 10);
                if (trackNo in currentSearchPaths) {
                    itunes.playSong(currentSearchPaths[trackNo].path);
                } else {
                    h.reply("No such index.");
                }
            }
        }, {
            messageRegExp : /what'?s playing\??/,
            callback : function (h) {
                itunes.playerState(function (state) {
                    if (state !== "playing") {
                        h.reply("iTunes is " + state);
                    } else {
                        itunes.whatsPlaying(function (data) {
                            h.reply(data);
                        });
                    }
                })
            }
        }, {
            messageRegExp : /^search (.+)/,
            callback : function (h) {
                currentSearchPaths = [];
                var query = h.regExp[1];

                currentSearchPaths.query = query;
                itunes.search(query, function (res) {
                    console.log('got data');
                    var tracks = parseAppleScriptTracks(res)
                    if (tracks.length === 0) {
                        h.reply("Nothing found!");
                    } else {
                        for (var i = 0; i < tracks.length && i < 3; i++) {
                            var t = tracks[i];
                            currentSearchPaths.push({
                                path : t.path,
                                index  : i,
                                trackName : t.name
                            });
                            h.reply(i + "\) " + t.name);
                        }

                        if (tracks.length > 3) {
                            h.reply("... and " + (tracks.length - 3) + " more tracks");
                        }
                    }
                });
            }
        } , {
            messageRegExp : /^printqueue/i,
            callback : function (h) {
                itunes.queueGet(function (res) {
                    if (res === '') {
                        h.reply("No queue.");
                    } else {
                        var tracks = parseAppleScriptTracks(res);
                        for (var i = 0; i < tracks.length && i < 3; i++) {
                            var t = tracks[i];
                            h.reply(i + "\) " + t.name);
                        }
                        if (tracks.length > 3) {
                            h.reply("... and " + (tracks.length - 3) + " more tracks");
                        }
                    }
                });
            }
        }, {
            messageRegExp : /^download http:\/\/([^\/]+)(\/\S+)/i,
            callback : function (h) {
                console.log('download');
                var host = h.regExp[1];
                var get = h.regExp[2];
                var destFileName = musicDest + Math.random() + ".mp3";
                downloadFileFromTo(host, get, destFileName, function () {
                    h.reply('Finished getting file. Playing...');
                    itunes.playSong(destFileName);
                });
            }
        }]
    }
});

var irc = ircWrapper.getIrc();

function downloadFileFromTo(host, get, dest, callback) {
    var ofs = fs.createWriteStream(dest, { encoding : 'binary' });
    ofs.on('open', function (fd) {
        console.log("opened " + dest + " for writing.");
        console.log("getting " + host + get);
        var h = http.createClient(80, host);
        var request = h.request('GET', get, {
            'host' : host
        });
        request.on('response', function (response) {
            response.setEncoding('binary');
            response.on('data', function (chunk) {
                ofs.write(chunk, 'binary');
            });
            response.on('end', function () {
                console.log('finished getting file.');
                ofs.end();
                callback();
            });
        });
        request.end();
    });
}
