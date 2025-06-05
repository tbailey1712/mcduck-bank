import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

/**
 * Performance monitoring and optimization utilities
 */

// Track Web Vitals metrics
export const trackWebVitals = () => {
  if (typeof window !== 'undefined' && 'performance' in window) {
    getCLS(console.log);
    getFID(console.log);
    getFCP(console.log);
    getLCP(console.log);
    getTTFB(console.log);
  }
};

// Performance observer for custom metrics
export const observePerformance = () => {
  if ('PerformanceObserver' in window) {
    // Observe Long Tasks (tasks that block the main thread for > 50ms)
    const longTaskObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        console.warn('Long Task detected:', {
          duration: entry.duration,
          startTime: entry.startTime,
          name: entry.name
        });
      }
    });

    try {
      longTaskObserver.observe({ entryTypes: ['longtask'] });
    } catch (e) {
      // PerformanceObserver not supported in this browser
    }

    // Observe Layout Shifts
    const layoutShiftObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) {
          console.warn('Layout Shift detected:', {
            value: entry.value,
            startTime: entry.startTime,
            sources: entry.sources
          });
        }
      }
    });

    try {
      layoutShiftObserver.observe({ entryTypes: ['layout-shift'] });
    } catch (e) {
      // PerformanceObserver not supported
    }
  }
};

// Measure component render performance
export const measureRenderTime = (componentName) => {
  const start = performance.now();
  
  return () => {
    const end = performance.now();
    const duration = end - start;
    
    if (duration > 16) { // Warn if render takes longer than one frame (60fps)
      console.warn(`${componentName} render took ${duration.toFixed(2)}ms`);
    }
    
    return duration;
  };
};

// Memory usage monitoring
export const logMemoryUsage = () => {
  if ('memory' in performance) {
    const memory = performance.memory;
    console.log('Memory Usage:', {
      used: `${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
      total: `${(memory.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
      limit: `${(memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB`
    });
  }
};

// Bundle size analyzer
export const analyzeBundleSize = () => {
  if ('performance' in window && 'getEntriesByType' in performance) {
    const entries = performance.getEntriesByType('navigation');
    const [navigation] = entries;
    
    if (navigation) {
      console.log('Page Load Performance:', {
        domContentLoaded: `${navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart}ms`,
        loadComplete: `${navigation.loadEventEnd - navigation.loadEventStart}ms`,
        totalTime: `${navigation.loadEventEnd - navigation.fetchStart}ms`
      });
    }
  }
};

// Debounce utility for performance
export const debounce = (func, wait, immediate = false) => {
  let timeout;
  
  return function executedFunction(...args) {
    const later = () => {
      timeout = null;
      if (!immediate) func(...args);
    };
    
    const callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    
    if (callNow) func(...args);
  };
};

// Throttle utility for performance
export const throttle = (func, limit) => {
  let inThrottle;
  
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

// Image lazy loading observer
export const createLazyImageObserver = (callback) => {
  if ('IntersectionObserver' in window) {
    return new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          callback(entry.target);
        }
      });
    }, {
      rootMargin: '50px 0px',
      threshold: 0.01
    });
  }
  return null;
};

// Resource hints for prefetching
export const prefetchResource = (url, type = 'fetch') => {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.as = type;
      link.href = url;
      document.head.appendChild(link);
    });
  }
};

// Component performance wrapper (requires React to be imported where used)
export const withPerformanceTracking = (WrappedComponent, componentName) => {
  // This function should be used with React imported in the consuming component
  return (React) => React.memo((props) => {
    const measureEnd = measureRenderTime(componentName);
    
    React.useEffect(() => {
      measureEnd();
    });
    
    return React.createElement(WrappedComponent, props);
  });
};

// Resource timing analysis
export const analyzeResourceTiming = () => {
  if ('performance' in window && 'getEntriesByType' in performance) {
    const resources = performance.getEntriesByType('resource');
    
    const slowResources = resources.filter(resource => 
      resource.duration > 1000 || resource.responseEnd - resource.responseStart > 500
    );
    
    if (slowResources.length > 0) {
      console.warn('Slow loading resources detected:', slowResources.map(r => ({
        name: r.name,
        duration: `${r.duration.toFixed(2)}ms`,
        type: r.initiatorType
      })));
    }
    
    return {
      totalResources: resources.length,
      slowResources: slowResources.length,
      avgDuration: resources.reduce((sum, r) => sum + r.duration, 0) / resources.length
    };
  }
  
  return null;
};

// Initialize performance monitoring
export const initPerformanceMonitoring = () => {
  if (process.env.NODE_ENV === 'development') {
    observePerformance();
    
    // Log memory usage every 30 seconds in development
    setInterval(logMemoryUsage, 30000);
    
    // Analyze resources after initial load
    setTimeout(analyzeResourceTiming, 5000);
  }
  
  // Always track web vitals
  trackWebVitals();
};