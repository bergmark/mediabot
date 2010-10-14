var IRC = require('./IRC-js/lib/irc');
var spawn = require('child_process').spawn;
var fs = require('fs');
var http = require('http');
var sys = require('sys');

// CACTUS INCLUDES
Function.prototype.bind = function (scope, arg1) {
    var args = Array.prototype.slice.call (arguments, 1);
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

require('./cactus/trunk/Addon/Function.js');

var musicDest = "/Users/adam/musi/downloaded/";
var ircServer = "irc.vassius.se";
//ircServer = "irc.freenode.net";
//ircServer = "se.quakenet.org";
var nick = "mediabot2";
var joinChan = "#c-test2";
//joinChan = "#natur2";

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

var play = runCmd.curry('osascript', ['-e', 'tell app "iTunes" to play']);
var pause = runCmd.curry('osascript', ['-e', 'tell app "iTunes" to pause']);
var playSong = function (filePath, callback) {
    runCmd('open', ['-a', '/Applications/iTunes.app', filePath], callback);
};
var queueSong = function (query, index, callback) {
    runCmd('itunes-queue', [query, index], callback);
};

var whatsPlaying = runCmd.curry('itunes-whatsplaying', undefined);

var search = function (query, callback) {
    runCmd('itunes-search', [query], callback);
};
var queueGet = runCmd.curry('itunes-queue-get', null);

var currentPosInPlaylist = function (callback) {
    runCmd('itunes-current-pos-in-playlist', null, function (contents) {
        callback(contents === "" ? 1 : parseInt(contents, 10));
    });
};
var lengthOfPlaylist = function (callback) {
    runCmd('itunes-length-of-playlist', null, function (contents) {
        callback(parseInt(contents, 10));
    });
};

var irc = new IRC({
    server : ircServer,
    nick : nick
});

var currentSearchPaths = [];

irc.addListener("privmsg", function (e) {
    var person = e.person;
    var command = e.command;
    var chan = e.params[0];
    var msg = e.params[1];

    if (msg === "play") {
        play();
    } else if (/^queue (\d+)/.test(msg)) {
        var trackNo = parseInt(RegExp.$1, 10);
        if (trackNo in currentSearchPaths) {
            queueSong(currentSearchPaths.query, trackNo + 1, function () {
                currentPosInPlaylist(function (curPos) {
                    lengthOfPlaylist(function (lengthOfPlaylist) {
                        var queuePos = lengthOfPlaylist - curPos + 1;
                        irc.privmsg(chan,
                                    "Queued " + currentSearchPaths[trackNo].trackName + " in position " + queuePos);
                    });
                });
            });
        } else {
            irc.privmsg(chan, "No such index.");
        }
    } else if (/^play (\d+)/.test(msg)) {
        var trackNo = parseInt(RegExp.$1, 10);
        if (trackNo in currentSearchPaths) {
            playSong(currentSearchPaths[trackNo].path);
        } else {
            irc.privmsg(chan, "No such index.");
        }
    } else if (msg === "pause") {
        pause();
    } else if (msg === "what's playing?") {
        whatsPlaying(function (data) {
            irc.privmsg(chan, data);
        });
    } else if (/^search (.+)/.test(msg)) {
        currentSearchPaths = [];
        var query = RegExp.$1;

        currentSearchPaths.query = query;
        search(query, function (res) {
            console.log('got data');
            var tracks = res.split("@!@");
            tracks.pop();
            if (tracks.length === 0) {
                irc.privmsg(chan, "Nothing found!");
            } else {
                for (var i = 0; i < tracks.length && i < 3; i++) {
                    var t = tracks[i].split("!!@!!");
                    var track = t[0];
                    var path = t[1];
                    console.log(track);
                    currentSearchPaths.push({
                        path : path,
                        index  : i,
                        trackName : track
                    });
                    irc.privmsg(chan, i + "\) " + track);
                }

                if (tracks.length > 3) {
                    irc.privmsg(chan, "... and " + (tracks.length - 3) + " more tracks");
                }
            }
        });
    } else if (/^printqueue/i.test(msg)) {
        queueGet(function (res) {
            var tracks = res.split('@!@');
            tracks.pop();
            for (var i = 0; i < tracks.length && i < 3; i++) {
                var t = tracks[i].split('!!@!!');
                var track = t[0];
                var path = t[1];
                irc.privmsg(chan, i + "\) " + track);
            }
            if (tracks.length > 3) {
                irc.privmsg(chan, "... and " + (tracks.length - 3) + " more tracks");
            }
        });
    } else if (/^download http:\/\/([^\/]+)(\/\S+)/i.test(msg)) {
        console.log('download');
        var host = RegExp.$1;
        var get = RegExp.$2;
        var destFileName = musicDest + Math.random() + ".mp3";
        downloadFileFromTo(host, get, destFileName, function () {
            irc.privmsg(chan, 'Finished getting file. Playing...');
            playSong(destFileName);
        });
    } else if (msg === "quit") {
        irc.quit();
    } else {
        console.log('unhandled: ' + msg);
    }
});

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

irc.connect(function () {
    irc.join(joinChan);
});
