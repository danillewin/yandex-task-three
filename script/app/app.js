function PlayerModel () {
    var self = this;
        tracks = ko.observableArray([]);

    self.addTrack = function (file) {
        var tags,
            track;

        ID3.loadTags(file, function() {
            tags = ID3.getAllTags(file);

            track = {
                artist: tags.artist,
                title: tags.title,
                album: tags.album,
                lyrics: tags.lyrics,
                picture: tags.picture
            }
            tags: ['title', 'artist', 'picture', 'album', 'lyrics'],
            console.log(track);
        },
        {
            dataReader: FileAPIReader(file)
        });
    }
}

ko.applyBindings(new PlayerModel());
