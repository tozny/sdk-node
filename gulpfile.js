var gulp    = require('gulp')
  , cp      = require('child_process')
  , jasmine = require('gulp-jasmine')
;

gulp.task('default', function() {
  // place code for your default task here
});

gulp.task('test', function() {
  return gulp.src('test/*_test.js').pipe(jasmine());
});

gulp.task('doc', function (cb) {
  cp.exec('jsduck --config=jsduck.json', cb);
});
