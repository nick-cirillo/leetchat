(function () {
    console.log('[Injected] Script running');
    if (window.monaco && window.monaco.editor) {
      const editors = window.monaco.editor.getEditors();
      if (editors.length > 0) {
        const code = editors[0].getValue();
        window.postMessage({ type: 'FROM_PAGE_MONACO', code }, '*');
      }
    }
  })();