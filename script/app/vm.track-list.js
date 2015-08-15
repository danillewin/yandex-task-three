(function (app) {

    app.vm.TrackList = function () {
        var self = this;

        self.tracks = ko.observableArray([]);
        self.events = new app.vm.Events()
        self.isPlaying = ko.observable();
        self.currentTrack = ko.observable();

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
                loaded: ko.observable(false),
                artist: tags.artist || "unknown",
                title: tags.title || "unknown",
                album: tags.album || "unknown",
                year: tags.year,
                lyrics: tags.lyrics,
                picture: imgUrl,
            }

            reader.onload = function () {
                context.decodeAudioData(reader.result, function(audio){
                    track.loaded(true);
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
        var self = this,
            count = 0;

        document.getElementsByClassName("track-list")[0].addEventListener('dragenter', function (e) {
            count++;

            this.classList.add("track-list_dragover");
        });

        document.getElementsByClassName("track-list")[0].addEventListener('dragleave', function (e) {
            count--;

            if (count == 0) {
                this.classList.remove("track-list_dragover");
            }
        });

        document.getElementsByClassName("track-list")[0].addEventListener('drop', function (e) {
            var files = e.dataTransfer.files;

            count = 0;

            if (e.preventDefault) {
                e.preventDefault();
            }

            this.classList.remove("track-list_dragover");

            for (var key in files) {
                if (typeof(files[key]) == 'object' && files[key].type.indexOf('audio') > -1) {
                    self.addTrack(files[key]);
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
        var self = this;

        app.Events.fireEvent(self.events.NAMES.TRACK_SWITCH, data)
    };

})(window.app);
