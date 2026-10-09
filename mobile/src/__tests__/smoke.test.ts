it('env flag selects mocks explicitly', () => {
  expect(typeof process.env.EXPO_PUBLIC_USE_MOCKS).toBe('string');
});
