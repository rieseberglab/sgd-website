const gulp    = require('gulp');
const del     = require('del');
const bSync   = require('browser-sync');
const merge   = require('merge2');
const through = require('through2').obj;
const queue   = require('streamqueue').obj;

const plugins = require('gulp-load-plugins')({
        pattern: ['gulp-*', 'gulp.*', 'main-bower-files'],
        replaceString: /\bgulp[\-.]/
});

const arguments = require('yargs').argv;
const isProd = (arguments.env === 'prod');
const destination = arguments.outDir ? arguments.outDir : 'dist';

const noop = () => {
  return through();
};

const dev = (task) => {
  return isProd ? noop() : task;
};

const prod = (task) => {
  return isProd ? task : noop();
};

// Clean task returns a Promise
gulp.task('clean', () => {
   return del([destination]);
});

// We need to load the CSS in a certain order so we use a queue.
// Some options are specific to development, such as generating sourcemaps.
gulp.task('css', () => {
   return queue(gulp.src(plugins.mainBowerFiles('**/*.css')),
                gulp.src('public/stylesheets/*.styl')
                   .pipe(plugins.stylus())
          ).pipe(dev(plugins.debug()))
           .pipe(dev(plugins.sourcemaps.init()))
           .pipe(plugins.autoprefixer())
           .pipe(plugins.cached('css-ugly'))
           .pipe(plugins.csso())
           .pipe(plugins.remember('css-ugly'))
           .pipe(plugins.concat('main.min.css'))
           .pipe(dev(plugins.sourcemaps.write())) //'.', { sourceRoot = 'css-source'})))
           .pipe(gulp.dest(destination + '/css'));
});

// Fonts have to be loaded from separate locations, so we create multiple streams
// and merge them.
gulp.task('fonts', () => {
   let fontParams = [{
     files: ['bower_components/font-awesome/fonts/*', 'bower_components/bootstrap/fonts/*'],
     dest: destination + '/fonts'
   },
   {
     files: ['bower_components/flexslider/fonts/*'],
     dest: destination + '/css/fonts'
   }];

   // imperative style
   //var streams = [];
   //for (i in fontParams) {
     //dev(console.log(fontParams[i].files));
     //dev(console.log(fontParams[i].dest));

     //var stream = gulp.src(fontParams[i].files)
      //    .pipe(plugins.copy(fontParams[i].dest, { prefix: 3 }))
      //    .pipe(gulp.dest(fontParams[i].dest));
      //streams.push(stream)
   //}

   // declarative style
   let streams = fontParams.map((v, i) => {
     return gulp.src(fontParams[i].files)
         .pipe(plugins.copy(fontParams[i].dest, { prefix: 3 }))
         .pipe(gulp.dest(fontParams[i].dest))
   });

   return merge(streams);
});

// Check for syntax errors when JS files are changed
gulp.task('test', () => {
   return gulp.src(['public/javascripts/**/*.js', '!public/javascripts/mailer.js', '!public/plugins/**/*.js'])
      .pipe(plugins.jshint())
      .pipe(plugins.jshint.reporter('default'))
      .pipe(plugins.jshint.reporter('fail'));
});

gulp.task('scripts-main', () => {
   let jsMainFiles = ['public/javascripts/back-to-top.js', 'public/javascripts/main.js', 'public/javascripts/sgd_ga.js', 'bower_components/jflickrfeed/jflickrfeed.js']; //, '!bower_components/gmaps/gmaps.js'];

   return gulp.src(plugins.mainBowerFiles('**/*.js').concat(jsMainFiles))
      .pipe(dev(plugins.debug()))
      .pipe(dev(plugins.sourcemaps.init()))
      .pipe(plugins.cached('js-ugly-main'))
      .pipe(plugins.uglify())
      .pipe(plugins.remember('js-ugly-main'))
      .pipe(plugins.concat('main.min.js'))
      .pipe(dev(plugins.sourcemaps.write())) //'.', { sourceRoot = 'js-source'})))
      .pipe(gulp.dest(destination + '/js'));
});

gulp.task('scripts-contact', () => {
   let jsContactFiles = ['bower_components/gmaps/gmaps.min.js','public/javascripts/map.js', 'public/javascripts/sgd_ga.js', 'public/javascripts/mailer.js'];
	//var jsContactFiles = ['public/javascripts/map.js', 'public/javascripts/sgd_ga.js', 'public/javascripts/mailer.js'];

   return gulp.src(jsContactFiles)
      .pipe(dev(plugins.debug()))
      .pipe(dev(plugins.sourcemaps.init()))
      .pipe(plugins.cached('js-ugly-contact'))
      .pipe(plugins.uglify())
      .pipe(plugins.remember('js-ugly-contact'))
      .pipe(plugins.concat('contact.min.js'))
      .pipe(dev(plugins.sourcemaps.write())) //'.', { sourceRoot = 'js-source'})))
      .pipe(gulp.dest(destination + '/js'));
});

gulp.task('scripts', gulp.series('test', gulp.parallel('scripts-main', 'scripts-contact')));

gulp.task('html', () => {
   return gulp.src('views/**/*.pug')
      .pipe(plugins.pug({ doctype: 'html', pretty: false }))
      .pipe(gulp.dest(destination + '/html'))
});

gulp.task('images', () => {
   return gulp.src('public/images/**/*')
      .pipe(plugins.imagemin([
        plugins.imagemin.gifsicle({interlaced: true}),
        plugins.imagemin.jpegtran({progressive: true}),
        plugins.imagemin.optipng({optimizationLevel: 5}),
        plugins.imagemin.svgo({plugins: [{removeViewBox: true}]})
      ],
      {
        verbose: true
      }))
      .pipe(gulp.dest(destination + '/images'))
      //.pipe(plugins.imagemin())
      //.pipe(gulp.dest(destination + '/images'))
});

// the browser-sync recipe below is modified for gulp v4 from:
// https://github.com/sogko/gulp-recipes/tree/master/browser-sync-nodemon-expressjs
gulp.task('nodemon', (cb) => {
   let started = false;

   return plugins.nodemon({
      script: './bin/www'
	}).on('start', () => {
        // ensure start only got called once
	if (!started) {
	   cb();
	   started = true;
	}
   });
});

gulp.task('browser-sync',
   gulp.series('nodemon', function nodemonTask(done) {
     if(!isProd) {
       return bSync.init(null, {
	  proxy: 'http://localhost:3000',
	  files: [destination + '/**/*.*'],
	  browser: 'google chrome',
	  port: 4000,
       });
    }
    done();
   })
);
//browser-sync

gulp.task('default',
   gulp.series('clean', gulp.parallel('html', 'css', 'images', 'scripts', 'fonts'), 'browser-sync',
      function watcher(done) {
          if(!isProd) {
            gulp.watch('views/**/*.pug', gulp.parallel('html'));
            gulp.watch('public/javascripts/**/*.js', gulp.parallel('scripts'));
            gulp.watch('public/stylesheets/**/*.styl', gulp.parallel('css'));
            gulp.watch(destination + '/**/*', bSync.reload);
          }
        done();
   })
);
