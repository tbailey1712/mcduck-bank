import React, { useState, useRef, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Box, Skeleton } from '@mui/material';
import { createLazyImageObserver } from '../utils/performance';

const OptimizedImage = React.memo(({
  src,
  alt,
  width,
  height,
  placeholder,
  className,
  style = {},
  lazy = true,
  quality = 75,
  sizes,
  srcSet,
  onLoad,
  onError,
  ...props
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(!lazy);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef(null);
  const observerRef = useRef(null);

  // Handle intersection observer for lazy loading
  useEffect(() => {
    if (!lazy || isInView) return;

    const handleIntersection = (target) => {
      setIsInView(true);
      if (observerRef.current) {
        observerRef.current.unobserve(target);
      }
    };

    observerRef.current = createLazyImageObserver(handleIntersection);

    if (observerRef.current && imgRef.current) {
      observerRef.current.observe(imgRef.current);
    }

    return () => {
      if (observerRef.current && imgRef.current) {
        observerRef.current.unobserve(imgRef.current);
      }
    };
  }, [lazy, isInView]);

  // Handle image load
  const handleLoad = useCallback((event) => {
    setIsLoaded(true);
    setHasError(false);
    if (onLoad) {
      onLoad(event);
    }
  }, [onLoad]);

  // Handle image error
  const handleError = useCallback((event) => {
    setHasError(true);
    setIsLoaded(false);
    if (onError) {
      onError(event);
    }
  }, [onError]);

  // Generate optimized image URL
  const getOptimizedSrc = useCallback((originalSrc) => {
    if (!originalSrc) return '';
    
    // If it's a data URL or external URL, return as-is
    if (originalSrc.startsWith('data:') || originalSrc.startsWith('http')) {
      return originalSrc;
    }
    
    // For local images, you could add optimization parameters here
    // This is a placeholder for image optimization service integration
    return originalSrc;
  }, []);

  // Create responsive srcSet if not provided
  const generateSrcSet = useCallback((originalSrc) => {
    if (srcSet) return srcSet;
    if (!originalSrc || originalSrc.startsWith('data:')) return undefined;
    
    // Generate responsive variants
    // This is a placeholder - you would integrate with your image optimization service
    const variants = [
      `${getOptimizedSrc(originalSrc)} 1x`,
      `${getOptimizedSrc(originalSrc)} 2x`
    ];
    
    return variants.join(', ');
  }, [srcSet, getOptimizedSrc]);

  const optimizedSrc = getOptimizedSrc(src);
  const responsiveSrcSet = generateSrcSet(src);

  // Render placeholder while loading or if lazy loading hasn't triggered
  if (!isInView || (!isLoaded && !hasError)) {
    return (
      <Box
        ref={imgRef}
        sx={{
          width: width || '100%',
          height: height || 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'grey.100',
          ...style
        }}
        className={className}
      >
        {placeholder || (
          <Skeleton
            variant="rectangular"
            width={width || '100%'}
            height={height || 200}
            animation="wave"
          />
        )}
      </Box>
    );
  }

  // Render error state
  if (hasError) {
    return (
      <Box
        sx={{
          width: width || '100%',
          height: height || 200,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'grey.200',
          color: 'text.secondary',
          ...style
        }}
        className={className}
      >
        Failed to load image
      </Box>
    );
  }

  // Render actual image
  return (
    <Box
      sx={{
        width: width || '100%',
        height: height || 'auto',
        position: 'relative',
        overflow: 'hidden',
        ...style
      }}
      className={className}
    >
      <img
        ref={imgRef}
        src={optimizedSrc}
        srcSet={responsiveSrcSet}
        sizes={sizes}
        alt={alt}
        onLoad={handleLoad}
        onError={handleError}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transition: 'opacity 0.3s ease-in-out',
          opacity: isLoaded ? 1 : 0
        }}
        loading={lazy ? 'lazy' : 'eager'}
        decoding="async"
        {...props}
      />
    </Box>
  );
});

OptimizedImage.displayName = 'OptimizedImage';

OptimizedImage.propTypes = {
  src: PropTypes.string.isRequired,
  alt: PropTypes.string.isRequired,
  width: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  height: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  placeholder: PropTypes.node,
  className: PropTypes.string,
  style: PropTypes.object,
  lazy: PropTypes.bool,
  quality: PropTypes.number,
  sizes: PropTypes.string,
  srcSet: PropTypes.string,
  onLoad: PropTypes.func,
  onError: PropTypes.func,
};

export default OptimizedImage;