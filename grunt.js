module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: '<json:package.json>',
    test: {
      files: ['tests/**/*.js']
    },
    lint: {
      files: ['grunt.js', 'lib/**/*.js', 'tests/**/*.js']
    },
    watch: {
      files: '<config:lint.files>',
      tasks: 'default'
    }
  });

  // Default task.
  grunt.registerTask('default', 'lint test');

};
