app = {};

app.vm = {};

app.getRandomInt = function (min, max){
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

Number.prototype.formatTime = function () {
    var hours   = Math.floor(this / 3600),
        minutes = Math.floor((this - (hours * 3600)) / 60),
        seconds = Math.floor(this - (hours * 3600) - (minutes * 60));

    if (minutes < 10) {
        minutes = "0" + minutes;
    }
    if (seconds < 10) {
        seconds = "0" + seconds;
    }

    return minutes + ':' + seconds;
}

try {
    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    app.AudioContext = new AudioContext();
}
catch(e) {
    alert('Web Audio API is not supported in this browser');
}


(function (app) {

    app.vm.TrackList = function () {
        var self = this;

        self.tracks = ko.observableArray([]);

        self.initDragDrop();
    }

    app.vm.TrackList.prototype.addTrack = function (file) {
        var self = this,
            tags,
            track,
            image,
            base64String = "",
            imgUrl,
            reader = new FileReader(),
            context = app.AudioContext;

        ID3.loadTags(file, function() {
            tags = ID3.getAllTags(file);


            if (tags.picture) {

                image = tags.picture;

                for (var i = 0; i < image.data.length; i++) {
                    base64String += String.fromCharCode(image.data[i]);
                }

                imgUrl = "data:" + image.format + ";base64," + window.btoa(base64String);
            }
            else {
                imgUrl = "images/unknown.png"
            }

            track = {
                artist: tags.artist || "unknown",
                title: tags.title || "unknown",
                album: tags.album || "unknown",
                year: tags.year,
                lyrics: tags.lyrics,
                picture: imgUrl,
            }

            reader.onload = function () {
                context.decodeAudioData(reader.result, function(audio){
                    track.audio = audio;
                });

                self.tracks.push(track);
            };

            reader.readAsArrayBuffer(file);
        },
        {
            tags: ["artist", "title", "album", "year", "lyrics", "picture"],
            dataReader: FileAPIReader(file)
        });
    };

    app.vm.TrackList.prototype.initDragDrop = function () {
    var self = this;

        document.getElementsByClassName("track-list")[0].addEventListener('dragenter', function (e) {
            this.classList.add("track-list_dragover");
        });

        document.getElementsByClassName("track-list")[0].addEventListener('dragleave', function (e) {
            this.classList.remove("track-list_dragover");
        });

        document.getElementsByClassName("track-list")[0].addEventListener('drop', function (e) {
            if (e.preventDefault) {
                e.preventDefault();
            }

            this.classList.remove("track-list_dragover");

            for (var key in e.dataTransfer.files) {
                if (typeof(e.dataTransfer.files[key]) == 'object') {
                    self.addTrack(e.dataTransfer.files[key]);
                }
            };

            return false;
        });

        document.getElementsByClassName("track-list")[0].addEventListener('dragover', function (e) {
            if (e.preventDefault) {
                e.preventDefault();
            }

            e.dataTransfer.dropEffect = 'copy';

            return false;
        });
    };

    app.vm.TrackList.prototype.setTrack = function (data) {
        var player = app.Player;

        if (player.currentTrack() != data) {
            player.setTrack(data);
        }
        else {
            if (player.playing()) {
                player.pause();
            }
            else {
                player.play()
            }

        }
    };

    app.vm.TrackList.prototype.bindPlayer = function () {
        var self = this;

        self.currentTrack = app.Player.currentTrack;
        self.isPlaying = app.Player.playing;
    };

})(window.app);

app.TrackList = new app.vm.TrackList();

ko.applyBindings(app.TrackList, document.getElementsByClassName("track-list")[0]);

(function (app) {

    app.vm.Player = function () {
        var self = this;

        self.context = app.AudioContext;
        self.gainNode = self.context.createGain();
        self.equalizerNode = self.createFilters();
        self.analyser = self.context.createAnalyser();
        self.analyser.fftSize = 256;
        self.canvasCtx = (document.getElementsByClassName("js-visualization-canvas")[0 ]).getContext("2d");
        self.currentTime = ko.observable(0);
        self.playing = ko.observable(false);
        self.volume = ko.observable(100);
        self.volumeBuffer;
        self.currentProgress = ko.observable(0);
        self.currentDuration = ko.observable(0);
        self.currentStartTime;
        self.currentProgressTime = ko.observable(0);
        self.repeat = ko.observable(true);
        self.shuffle = ko.observable();
        self.currentTrack = ko.observable();
        self.tracks = app.TrackList.tracks;
        self.tracksBuffer = [];
        self.chronometer;
        self.currentPreset = ko.observable("normal");
        self.presets = [
            {
                name: "pop",
                values: [5, 4, 3, 2, 3, 4, 5]
            },
            {
                name: "rock",
                values: [4, 2, 0, 2, 2, 0, 1]
            },
            {
                name: "jazz",
                values: [6, 1, 4, 2, 0, 5, 1]
            },
            {
                name: "classic",
                values: [4, 5, 4, 5, 4, 5, 4]
            },
            {
                name: "normal",
                values: [0, 0, 0, 0, 0, 0, 0]
            }
        ]

        self.volume.subscribe(function (value) {
            self.gainNode.gain.value = value / 100;
        });

        self.tracks.subscribe(function () {
            if (self.tracks().length == 1) {
                self.currentTrack(self.tracks()[0]);
            }
        });

        self.resolveVolumeClass = ko.computed(function() {
            var postfix,
                volume = self.volume();

            if (volume > 80) {
                return "up"
            }

            if (volume <= 80 && volume > 0) {
                return "down"
            }

            return "off"
        })

        self.bindProgressBar();
    }

    app.vm.Player.prototype.bindProgressBar = function () {
        var self = this,
            wrapper = document.getElementsByClassName('js-control-progress')[0],
            inner = document.getElementsByClassName('js-control-progress-inner')[0],
            input = document.getElementsByClassName('js-control-progress-input')[0],
            progress;

        wrapper.addEventListener('click', function(e) {
            progress = Math.floor((e.offsetX / wrapper.offsetWidth) * 100);
            self.setTime(progress);
        }, false);
    }

    app.vm.Player.prototype.playPause = function () {
        var self = this;

        if (!self.playing()) {
            self.play();
        }
        else {
            self.pause();
        }
    }

    app.vm.Player.prototype.play = function () {
        var self = this;

        if (self.currentTrack()){
            self.source = self.context.createBufferSource();
            self.source.buffer = self.currentTrack().audio;
            self.source.connect(self.gainNode);
            self.gainNode.connect(self.equalizerNode[0]);
            self.equalizerNode[self.equalizerNode.length - 1].connect(self.context.destination);
            if (self.currentProgressTime() == 0) {
                self.currentStartTime = self.context.currentTime;
                self.currentDuration(self.source.buffer.duration);
            }
            self.source.start(0, self.currentProgressTime());
            self.playing(true);
            self.source.onended = self.onEnd.bind(self);
            self.startChronometer();
            self.visualize();
        }
        else {
            alert("Upload the track first");
        }

    }

    app.vm.Player.prototype.pause = function () {
        var self = this;

        self.source.stop();
        self.playing(false);
        self.killChronometer();
    }

    app.vm.Player.prototype.next = function () {
        var self = this,
            index,
            tracks = self.tracks(),
            length = tracks.length;

        index = tracks.indexOf(self.currentTrack()) + 1;

        if (index >= length) {
            if (self.repeat()) {
                self.setTrack(tracks[0]);
            } else {
                self.stop();
                self.currentTrack(self.tracks()[0]);
                return;
            }

        } else {
            self.setTrack(tracks[index]);
        }

    }

    app.vm.Player.prototype.prev = function () {
        var self = this,
        index,
        tracks = self.tracks(),
        length = tracks.length;

        index = tracks.indexOf(self.currentTrack()) - 1;
        if (index < 0) {

            if (self.repeat()) {
                self.setTrack(tracks[length - 1]);
            } else {
                return;
            }

        } else {
            self.setTrack(tracks[index]);
        }
    }

    app.vm.Player.prototype.stop = function () {
        var self = this;

        self.source.stop();
        self.killChronometer();
        self.currentProgress(0);
        self.currentProgressTime(0);
        self.playing(false);
}

    app.vm.Player.prototype.setTrack = function (track) {
        var self = this;

        self.stop();
        self.currentTrack(track);
        self.play();
    }

    app.vm.Player.prototype.setTime = function (percent) {
        var self = this,
            time = self.currentDuration() / 100 * percent;

        self.stop();
        self.currentProgressTime(time);
        self.play();
    }

    app.vm.Player.prototype.onEnd = function () {
        var self = this;

        if (Math.floor(self.currentProgressTime()) >= Math.floor(self.currentDuration())) {
            self.next()
        }
    }

    app.vm.Player.prototype.visualize = function () {
        var self = this,
            bufferLength = self.analyser.frequencyBinCount,
            dataArray = new Uint8Array(bufferLength),
            WIDTH = self.canvasCtx.canvas.width,
            HEIGHT = self.canvasCtx.canvas.height;

        self.equalizerNode[self.equalizerNode.length - 1].connect(self.analyser);

        var draw = function () {
            var barWidth = Math.floor((WIDTH / bufferLength) * 2),
                barHeight,
                drawVisual,
                x = 0;

            if (self.playing()){
                drawVisual = requestAnimationFrame(draw);


                self.analyser.getByteFrequencyData(dataArray);
                self.canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);
                for (var i = 0; i < bufferLength; i++) {
                    barHeight = Math.floor(dataArray[i] / 2);

                    self.canvasCtx.fillStyle = 'rgb(255,0,0)';
                    self.canvasCtx.fillRect(x, HEIGHT - barHeight, barWidth, barHeight);

                    x += barWidth + 1;
                }
            }
            else {
            for (var i = 0; i < bufferLength; i++) {
                    self.canvasCtx.fillStyle = 'rgb(255,0,0)';
                    self.canvasCtx.fillRect(x, 0, barWidth, 0);

                    x += barWidth + 1;
                }
            }
        };

        draw();
    }

    app.vm.Player.prototype.toggleMute = function () {
        var self = this,
            volume = self.volume();

        if (volume > 0) {
            self.volumeBuffer = volume;
            self.volume(0);
        } else {
            self.volume(self.volumeBuffer);
        }
    }

    app.vm.Player.prototype.toggleRepeat = function () {
        var self = this;

        self.repeat(!self.repeat());
    }

    app.vm.Player.prototype.toggleShuffle = function () {
        var self = this;

        self.shuffle(!self.shuffle());

        if (self.shuffle()) {
            self.tracksBuffer = self.tracks().slice(0);
            self.tracks(self.tracks().sort(function () {
                return app.getRandomInt(0,1);
            }))
        }
        else {
            self.tracks(self.tracksBuffer);
        }
    }

    app.vm.Player.prototype.startChronometer = function () {
            var self = this,
                start,
                duration = self.currentDuration();

            if (self.currentProgressTime() != 0) {
                self.currentStartTime = (self.context.currentTime - self.currentProgressTime())
            }

            start = self.currentStartTime;
            self.chronometer = setInterval(function () {
                var current = self.context.currentTime;
                self.currentProgressTime(current - start);
                self.currentProgress((self.currentProgressTime() / duration) * 100);
            },
            300);
    };

    app.vm.Player.prototype.killChronometer = function () {
        var self = this;

        clearInterval(self.chronometer)
    }

    app.vm.Player.prototype.createFilter = function (frequency) {
        var self = this,
            filter = self.context.createBiquadFilter();

        filter.type = 'peaking';
        filter.frequency.value = frequency;
        filter.Q.value = 1;
        filter.value = ko.observable();

        filter.value.subscribe(function (val) {
            filter.gain.value = val;
        })

        filter.value(0);


        return filter;
    };

    app.vm.Player.prototype.createFilters = function () {
        var self = this,
            frequencies = [60, 310, 600, 1000, 6000, 14000, 16000],
            filters = frequencies.map(self.createFilter.bind(self));

        filters.reduce(function (prev, curr) {
            prev.connect(curr);
            return curr;
        });

        return filters;
    };

    app.vm.Player.prototype.setEqualizer = function (data) {
        var self = this,
            preset = [];

        preset = self.presets.filter(function (item) {
            return item.name == data.name;
        })[0].values;

        self.currentPreset(data.name);

        for (var i = 0; i < self.equalizerNode.length; i++) {
            self.equalizerNode[i].value(preset[i]);
        }
    }

})(window.app);

app.Player = new app.vm.Player();

app.TrackList.bindPlayer();

ko.applyBindings(app.Player, document.getElementsByClassName("controls")[0]);

