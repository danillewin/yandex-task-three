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

        var file = e.dataTransfer.files[0];
        self.addTrack(file);

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
        self.currentTime = ko.observable(0);
        self.source = self.context.createBufferSource();
        self.playing = ko.observable(false);
        self.vol = ko.observable();
        self.repeat = ko.observable();
        self.shuffle = ko.observable();
        self.equalizer = ko.observable();
        self.currentTrack = ko.observable();
        self.currentTrack = ko.observable();
        self.tracks = app.TrackList.tracks;
        self.presets = {
            jazz : "",
            normal: "",
            rock: "",
            pop: ""
        }

        self.tracks.subscribe(function () {
            if (self.tracks().length == 1) {
                self.currentTrack(self.tracks()[0])
            }
        });
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

    app.vm.Player.prototype.pause = function () {
        var self = this;

        self.source.stop();
        self.playing(false);
    }

    app.vm.Player.prototype.play = function () {
        var self = this;

        if (self.currentTrack()){
            if (!self.source.buffer) {
                self.source.buffer = self.currentTrack().audio;
                self.source.connect(self.context.destination);
            }
            self.source.start(0);
            self.playing(true);
        }
        else {
            alert("Upload the track first");
        }

    }

    app.vm.Player.prototype.prev = function () {

    }

    app.vm.Player.prototype.next = function () {

    }

})(window.app);

app.Player = new app.vm.Player();

ko.applyBindings(app.Player, document.getElementsByClassName("controls")[0]);

