app = {};

app.vm = {};

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
    }

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
            self.addTrack(e.dataTransfer.files[key]);
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
}

})(window.app);

app.TrackList = new app.vm.TrackList();

ko.applyBindings(app.TrackList, document.getElementsByClassName("track-list")[0]);

(function (app) {

    app.vm.Player = function () {
        var self = this;

        self.context = app.AudioContext;
        self.gainNode = self.context.createGain();
        self.analyser = self.context.createAnalyser();
        self.analyser.fftSize = 256;
        self.canvasCtx = (document.getElementsByClassName("js-visualization-canvas")[0 ]).getContext("2d");
        self.currentTime = ko.observable(0);
        self.playing = ko.observable(false);
        self.volume = ko.observable(100);
        self.volumeBuffer;
        self.currentProgress = ko.observable(0);
        self.currentDuration;
        self.currentStartTime;
        self.currentProgressTime = ko.observable(0);
        self.repeat = ko.observable(true);
        self.shuffle = ko.observable();
        self.equalizer = ko.observable();
        self.currentTrack = ko.observable();
        self.tracks = app.TrackList.tracks;
        self.chronometer;
        self.presets = {
            jazz : "",
            normal: "",
            rock: "",
            pop: ""
        }

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
        var wrapper = document.getElementsByClassName('js-control-progress')[0],
            inner = document.getElementsByClassName('js-control-progress-inner')[0],
            input = document.getElementsByClassName('js-control-progress-input')[0],
            progress;

        wrapper.addEventListener('click', function(e) {
            inner.style.width = e.offsetX + "px";

            progress = Math.floor((e.offsetX / wrapper.offsetWidth) * 100);
            input.value = progress;
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
            self.gainNode.connect(self.context.destination);
            if (self.currentProgressTime() == 0) {
                self.currentStartTime = self.context.currentTime;
                self.currentDuration = self.source.buffer.duration;
            }
            self.source.start(0, self.currentProgressTime());
            self.startChronometer();
            self.playing(true);
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

    app.vm.Player.prototype.visualize = function () {
        var self = this,
            bufferLength = self.analyser.frequencyBinCount,
            dataArray = new Uint8Array(bufferLength),
            WIDTH = self.canvasCtx.canvas.width,
            HEIGHT = self.canvasCtx.canvas.height;

        self.gainNode.connect(self.analyser);

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

    app.vm.Player.prototype.startChronometer = function () {
            var self = this,
                start,
                duration = self.currentDuration;

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

})(window.app);

app.Player = new app.vm.Player();

ko.applyBindings(app.Player, document.getElementsByClassName("controls")[0]);

