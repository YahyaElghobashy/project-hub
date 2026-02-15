import { createContext, useContext, useEffect, useRef } from 'react';
import Perceptr from '@perceptr/web-sdk';

interface PerceptrContextType {
  identify: (distinctId: string, traits?: Record<string, any>) => Promise<void>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  pause: () => void;
  resume: () => void;
}

const PerceptrContext = createContext<PerceptrContextType | null>(null);


export function PerceptrProvider({ children }: any) {
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    // Initialize Perceptr SDK
    try {
      Perceptr.init({
        projectId: 'proj_NBoI1OTGUEZnU3jqBQ6l6b',
        debug: true,
        env: 'prod',
        session: {
          staleThreshold: 30 * 1000, // 30 seconds
        },
        network: {
          captureRequestBody: true,
          captureResponseBody: true,
          sanitizeHeaders: ['authorization', 'cookie'],
        },
      });
      Perceptr.start().catch((e: unknown) =>
        console.warn('Perceptr SDK start failed:', e)
      );
    } catch (e) {
      console.warn('Perceptr SDK init failed:', e);
    }
  }, []);

  const identify = async (distinctId: string, traits?: Record<string, any>) => {
    try {
      await Perceptr.identify(distinctId, traits);
    } catch (e) {
      console.warn('Perceptr identify failed:', e);
    }
  };

  const start = async () => {
    try {
      await Perceptr.start();
    } catch (e) {
      console.warn('Perceptr start failed:', e);
    }
  };

  const stop = async () => {
    try {
      await Perceptr.stop();
    } catch (e) {
      console.warn('Perceptr stop failed:', e);
    }
  };

  const pause = () => {
    try {
      Perceptr.pause();
    } catch (e) {
      console.warn('Perceptr pause failed:', e);
    }
  };

  const resume = () => {
    try {
      Perceptr.resume();
    } catch (e) {
      console.warn('Perceptr resume failed:', e);
    }
  };

  const value: PerceptrContextType = {
    identify,
    start,
    stop,
    pause,
    resume,
  };

  return (
    <PerceptrContext.Provider value={value}>
      {children}
    </PerceptrContext.Provider>
  );
}

export function usePerceptr() {
  const context = useContext(PerceptrContext);
  if (!context) {
    throw new Error('usePerceptr must be used within PerceptrProvider');
  }
  return context;
}
