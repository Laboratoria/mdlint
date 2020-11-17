const mdlint = require('.');

describe('mdlint', () => {
  it('should be a function', () => {
    expect(typeof mdlint).toBe('function');
  });

  it('should return a Promise', () => {
    expect(mdlint([]) instanceof Promise).toBe(true);
  });

  it('should resolve to empty results when paths array is empty', () => (
    mdlint([])
      .then(results => expect(Object.keys(results).length).toBe(0))
  ));

  it('should lint given file', () => (
    mdlint(['README.md'])
      .then((results) => {
        expect(Object.keys(results).length).toBe(1);
        // console.log(results);
      })
  ));
});
