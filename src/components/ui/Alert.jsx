import React, { useState, useEffect } from 'react';

const Alert = ({ 
  message, 
  type = 'error', 
  duration = 5000, 
  onClose,
  show = true 
}) => {
  const [isVisible, setIsVisible] = useState(show);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (show) {
      setIsVisible(true);
      setIsAnimating(true);
      
      const timer = setTimeout(() => {
        handleClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [show, duration]);

  const handleClose = () => {
    setIsAnimating(false);
    setTimeout(() => {
      setIsVisible(false);
      if (onClose) onClose();
    }, 300);
  };

  if (!isVisible) return null;

  const getAlertStyles = () => {
    const baseStyles = {
      position: 'fixed',
      top: '24px',
      right: '24px',
      zIndex: 1000,
      width: '400px',
      padding: '16px',
      background: 'rgb(255, 255, 255)',
      borderRadius: '12px',
      boxShadow: 'rgba(0, 0, 0, 0.1) 0px 4px 16px',
      border: '1px solid rgb(229, 231, 235)',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      overflow: 'hidden',
      animation: isAnimating 
        ? '0.4s ease-out 0s 1 normal none running slideInFromRight'
        : '0.3s ease-in 0s 1 normal none running slideOutToRight'
    };

    return baseStyles;
  };

  const getIconStyles = () => {
    const colors = {
      error: 'rgb(239, 68, 68)',
      success: 'rgb(34, 197, 94)',
      warning: 'rgb(245, 158, 11)',
      info: 'rgb(59, 130, 246)'
    };

    return {
      width: '20px',
      height: '20px',
      background: colors[type] || colors.error,
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      marginTop: '2px'
    };
  };

  const getProgressBarStyles = () => {
    const colors = {
      error: 'rgb(239, 68, 68)',
      success: 'rgb(34, 197, 94)',
      warning: 'rgb(245, 158, 11)',
      info: 'rgb(59, 130, 246)'
    };

    return {
      position: 'absolute',
      bottom: '0px',
      left: '0px',
      right: '0px',
      height: '3px',
      background: `rgba(${colors[type]?.replace('rgb(', '').replace(')', '')}, 0.2)`,
      borderRadius: '0px 0px 12px 12px'
    };
  };

  const getProgressFillStyles = () => {
    const colors = {
      error: 'rgb(239, 68, 68)',
      success: 'rgb(34, 197, 94)',
      warning: 'rgb(245, 158, 11)',
      info: 'rgb(59, 130, 246)'
    };

    return {
      height: '100%',
      width: '100%',
      background: colors[type] || colors.error,
      borderRadius: '0px 0px 12px 12px',
      animation: `${duration}ms linear 0s 1 normal forwards running slideLeftBorder`,
      transformOrigin: 'right center'
    };
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✓';
      case 'warning':
        return '⚠';
      case 'info':
        return 'i';
      default:
        return '!';
    }
  };

  return (
    <>
      <style>
        {`
          @keyframes slideInFromRight {
            from {
              transform: translateX(100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
          
          @keyframes slideOutToRight {
            from {
              transform: translateX(0);
              opacity: 1;
            }
            to {
              transform: translateX(100%);
              opacity: 0;
            }
          }
          
          @keyframes slideLeftBorder {
            from {
              transform: scaleX(1);
            }
            to {
              transform: scaleX(0);
            }
          }
        `}
      </style>
      <div style={getAlertStyles()}>
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px'
        }}>
          <div style={getIconStyles()}>
            <span style={{
              color: 'white',
              fontSize: '12px',
              fontWeight: 'bold'
            }}>
              {getIcon()}
            </span>
          </div>
          <div style={{ flex: '1 1 0%' }}>
            <div style={{
              color: 'rgb(55, 65, 81)',
              fontSize: '14px',
              fontFamily: 'Inter',
              fontWeight: '400',
              lineHeight: '20px',
              marginBottom: '4px'
            }}>
              {message}
            </div>
          </div>
          <button
            onClick={handleClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0px',
              color: 'rgb(156, 163, 175)',
              fontSize: '18px',
              lineHeight: '1',
              flexShrink: 0
            }}
          >
            ×
          </button>
        </div>
        <div style={getProgressBarStyles()}>
          <div style={getProgressFillStyles()}></div>
        </div>
      </div>
    </>
  );
};

export default Alert;