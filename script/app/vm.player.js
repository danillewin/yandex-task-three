(function (app) {

    app.vm.Player = function () {
        var self = this;

        self.events = new app.vm.Events();
        self.context = app.AudioContext;
        self.gainNode = self.context.createGain();
        self.equalizerNode = self.createFilters();
        self.analyser = self.context.createAnalyser();
        self.analyser.fftSize = 512;
        self.canvasCtx = (document.getElementsByClassName("js-visualization-canvas")[0]).getContext("2d");
        self.currentTime = ko.observable(0);
        self.playing = ko.observable(false);
        self.volume = ko.observable(100);
        self.volumeBuffer;
        self.currentProgress = ko.observable(0);
        self.currentDuration = ko.observable(0);
        self.currentStartTime;
        self.currentProgressTime = ko.observable(0);
        self.seekTime = ko.observable(0);
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
        self.visualizations = ["spectrum", "waveform"];
        self.currentVisualization = self.visualizations[0];

        self.volume.subscribe(function (value) {
            self.gainNode.gain.value = value / 100;
        });

        self.tracks.subscribe(function () {
            if (self.tracks().length == 1) {
                self.currentTrack(self.tracks()[0]);
            }
        });

        self.currentTrack.subscribe(function (value) {
            app.TrackList.currentTrack(value);
        });

        self.playing.subscribe(function (value) {
            app.TrackList.isPlaying(value);
        });

        self.resolveVolumeClass = ko.computed(function () {
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

        document.addEventListener("keyup" , function (e) {
            switch (e.which) {
                case 32:
                    self.playPause();
                    break;
                case 37:
                    self.prev();
                    break;
                case 39:
                    self.next();
                    break;
            }
        });

        document.getElementsByClassName("js-vol-btn")[0].addEventListener("wheel", function (e) {

            if (e.deltaY > 0) {
                self.soundDown();
            }
            else {
                self.soundUp();
            }
        });

        app.Events.registerEventCallback(self.events.NAMES.TRACK_SWITCH, self.events.REGISTRARS.Player, function (data) {
            self.setTrack(data);
        });
    }

    app.vm.Player.prototype.changeVisualization = function () {
        var self = this,
            visualizations = self.visualizations,
            length = visualizations.length,
            index;

        index = (visualizations.indexOf(self.currentVisualization) + 1) % length;
        self.currentVisualization = visualizations[index];
        self.visualize();
    }

    app.vm.Player.prototype.soundUp = function () {
        var self = this;

        if (self.volume() <= 90) {
            self.volume(self.volume() + 10);
        }
        else {
            self.volume(100);
        }
    }

    app.vm.Player.prototype.soundDown = function () {
        var self = this;

        if (self.volume() >= 10) {
            self.volume(self.volume() - 10);
        }
        else {
            self.volume(0);
        }
    }

    app.vm.Player.prototype.bindProgressBar = function () {
        var self = this,
            wrapper = document.getElementsByClassName('js-control-progress')[0],
            inner = document.getElementsByClassName('js-control-progress-inner')[0],
            input = document.getElementsByClassName('js-control-progress-input')[0],
            seek = document.getElementsByClassName('js-control-progress-seek')[0],
            progress;

        wrapper.addEventListener('click', function (e) {
            self.setTime(self.seekTime());
        }, false);

        wrapper.addEventListener('mousemove', function (e) {
            self.seekTime(Math.floor((e.offsetX / wrapper.offsetWidth) * self.currentDuration()));
            seek.style.width = e.offsetX + "px";
        }, false);

        wrapper.addEventListener('mousedown', function (e) {
            self.seekTime(Math.floor((e.offsetX / wrapper.offsetWidth) * self.currentDuration()));
            seek.style.width = e.offsetX + "px";
        }, false);

         wrapper.addEventListener('mouseout', function (e) {
            seek.style.width = "0px";
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

        if (self.currentTrack() && self.currentTrack().loaded()){
            self.source = self.context.createBufferSource();
            self.source.buffer = self.currentTrack().audio;
            self.source.connect(self.gainNode);
            self.gainNode.connect(self.equalizerNode[0]);
            self.equalizerNode[self.equalizerNode.length - 1].connect(self.context.destination);
            self.equalizerNode[self.equalizerNode.length - 1].connect(self.analyser);
            if (self.currentProgressTime() == 0) {
                self.currentStartTime = self.context.currentTime;
                self.currentDuration(self.source.buffer.duration);
            }
            self.source.start(0, self.currentProgressTime());
            self.playing(true);
            self.visualize();
            self.source.onended = self.onEnd.bind(self);
            self.startChronometer();
        }
        else {
            console.log("Upload the track first");
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

        if (self.currentProgressTime() >= 5) {
            self.stop();
            self.play();
            return;
        }

        index = tracks.indexOf(self.currentTrack()) - 1;

        if (index < 0) {

            if (self.repeat()) {
                self.setTrack(tracks[length - 1]);
            } else {
                self.stop();
                self.currentTrack(self.tracks()[0]);
                return;
            }

        } else {
            self.setTrack(tracks[index]);
        }
    }

    app.vm.Player.prototype.stop = function () {
        var self = this;

        self.source.stop();
        self.playing(false);
        self.killChronometer();
        self.currentProgress(0);
        self.currentProgressTime(0);
}

    app.vm.Player.prototype.setTrack = function (track) {
        var self = this;

        if (self.currentTrack() == track) {
            self.playPause();
            return;
        }

        if (self.playing()) {
            self.stop();
        }

        self.currentTrack(track);
        self.play();
    }

    app.vm.Player.prototype.setTime = function (time) {
        var self = this;

        self.pause();
        self.currentProgressTime(time);
        self.play();
    }

    app.vm.Player.prototype.onEnd = function () {
        var self = this;
        if (Math.ceil(self.currentProgressTime()) >= Math.floor(self.currentDuration())) {
            self.next()
        }
    }

        app.vm.Player.prototype.visualize = function () {
        var self = this,
            bufferLength = self.analyser.frequencyBinCount,
            dataArray = new Uint8Array(bufferLength),
            WIDTH = self.canvasCtx.canvas.width,
            HEIGHT = self.canvasCtx.canvas.height;

        cancelAnimationFrame(self.drawAnimationId);

        if (self.currentVisualization == "spectrum") {
            var draw = function () {
                var barWidth = Math.floor((WIDTH / bufferLength) * 2),
                    barHeight,
                    x = 0;

                self.drawAnimationId = requestAnimationFrame(draw);
                self.analyser.getByteFrequencyData(dataArray);
                self.canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);

                for (var i = 0; i < bufferLength; i++) {
                    barHeight = Math.floor(dataArray[i] * 1.5) + 2;
                    self.canvasCtx.fillStyle = 'rgb(255,0,0)';
                    self.canvasCtx.fillRect(x, HEIGHT - barHeight, barWidth, barHeight);

                    x += barWidth + 2;
                }
            };

            draw();
        }

        if (self.currentVisualization == "waveform") {
            var draw = function () {

                var sliceWidth = WIDTH * 1.0 / bufferLength,
                    x = 0;

                self.drawAnimationId = requestAnimationFrame(draw);
                self.analyser.getByteTimeDomainData(dataArray);
                self.canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);
                self.canvasCtx.lineWidth = 2;
                self.canvasCtx.strokeStyle = 'rgb(255, 0, 0)';
                self.canvasCtx.beginPath();

                for (var i = 0; i < bufferLength; i++) {
                    var v = dataArray[i] / 128.0;
                    var y = v * HEIGHT / 2;

                    if (i === 0) {
                        self.canvasCtx.moveTo(x, y);
                    } else {
                        self.canvasCtx.lineTo(x, y);
                    }

                    x += sliceWidth;
                }

                self.canvasCtx.lineTo(WIDTH, HEIGHT / 2);
                self.canvasCtx.stroke();
            };

            draw();
        }

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

    app.vm.Player.prototype.sortShuffle = function (array) {
        var tmp,
            current,
            top = array.length;

        if (top) while(--top) {
            current = Math.floor(Math.random() * (top + 1));
            tmp = array[current];
            array[current] = array[top];
            array[top] = tmp;
        }

        return array;
    }

    app.vm.Player.prototype.toggleShuffle = function () {
        var self = this;

        self.shuffle(!self.shuffle());

        if (self.shuffle()) {
            self.tracksBuffer = self.tracks().slice(0);
            self.tracks(self.sortShuffle(self.tracks()));
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
