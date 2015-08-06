module.exports = function(grunt) {
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        cssmin: {
            combine: {
                files: {
                    'style.min.css': ['style/*.css']
                }
            }
        },
        imagemin: {
           dist: {
              options: {
                optimizationLevel: 5
              },
              files: [{
                 expand: true,
                 cwd: 'images/',
                 src: ['*.{png,jpg,gif}'],
                 dest: 'images/'
              }]
           }
        },
        sprite: {
            all: {
                src: 'images/source/*.png',
                dest: 'images/icon.png',
                destCss: 'style/icon.css',
                cssTemplate: 'template.icon.css.handlebars',
                padding: 3
            }
        },
        'gh-pages': {
            options: {
              message: 'Auto-generated commit'
            },
            src: [
                'index.html',
                'style.min.css',
                'script.min.js',
                'script/lib/*.js',
                'images/*.png'
            ]
        },
        csscomb: {
            options: {
                config: '.csscomb.json'
            },
            files: {
                expand: true,
                cwd: 'style',
                src: ['*.css'],
                dest: 'style',
            }
        },
        uglify: {
            bundle:{
                options: {
                    sourceMap: true,
                    sourceMapName: 'script.map'
                },
                files: {
                    'script.min.js': ['script/app/**/*.js']
                }
            }
        },
        watch: {
            scripts: {
                files: 'script/app/**/*.js',
                tasks: ['script'],
                options: {
                    debounceDelay: 5000,
                },
            },
            style: {
                files: 'style/*.css',
                tasks: ['style'],
                options: {
                  debounceDelay: 5000,
                },
            }
        },
    });

    grunt.loadNpmTasks('grunt-contrib-cssmin');
    grunt.loadNpmTasks('grunt-csscomb');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-gh-pages');
    grunt.loadNpmTasks('grunt-contrib-imagemin');
    grunt.loadNpmTasks('grunt-spritesmith');

    grunt.registerTask('style', ['csscomb', 'cssmin']);
    grunt.registerTask('sprites', ['sprite', 'style']);
    grunt.registerTask('script', ['uglify:bundle']);
    grunt.registerTask('release', ['imagemin', 'gh-pages']);
};
