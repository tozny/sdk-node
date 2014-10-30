var gulp    = require('gulp')
  , jasmine = require('gulp-jasmine')
;

gulp.task('default', function() {
  // place code for your default task here
});

gulp.task('test', function() {
  return gulp.src('test/*_test.js').pipe(jasmine());
});
