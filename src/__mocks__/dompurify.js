// Mock DOMPurify for testing.
// Uses plain functions (not jest.fn) so resetMocks: true doesn't break them.
// Tests needing to spy on these can use jest.spyOn().

const sanitize = (input, config) => {
  if (typeof input !== 'string') return '';
  if (config && config.ALLOWED_TAGS && config.ALLOWED_TAGS.length === 0) {
    // Strip all HTML tags, keep content (matches real DOMPurify with KEEP_CONTENT)
    return input.replace(/<[^>]*>/g, '');
  }
  return input;
};

const DOMPurify = {
  sanitize,
  setConfig: () => {},
  clearConfig: () => {},
  isSupported: true,
  addHook: () => {},
  removeHook: () => {},
  removeHooks: () => {},
  removeAllHooks: () => {},
};

export default DOMPurify;
export { sanitize };
