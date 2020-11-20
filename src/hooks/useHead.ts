import { useEffect, useMemo, useRef } from 'react';
import dispatcher, { META, MetaPayload, TITLE } from '../dispatcher';
import { isServerSide } from '../utils';
import { MetaOptions } from './useMeta';

interface HeadObject {
  title?: string;
  metas?: MetaOptions[];
}

export const useHead = ({ title, metas }: HeadObject) => {
  const hasMounted = useRef(false);
  const prevTitle = useRef<string | undefined>();
  const prevMetas = useRef<MetaPayload[]>();
  const addedMetas = useRef<MetaPayload[]>();

  const memoizedMetas = useMemo(() => {
    const calculatedMetas: MetaPayload[] = (metas || []).map((meta) => {
      const keyword = meta.charset
        ? 'charset'
        : meta.name
        ? 'name'
        : meta.property
        ? 'property'
        : 'http-equiv';

      if (prevMetas.current) {
        const found = prevMetas.current.find(
          (x) =>
            x.keyword === keyword &&
            x.name === meta.name &&
            x.charset === meta.charset &&
            x['http-equiv'] === meta.httpEquiv &&
            x.property === meta.property &&
            x.content === meta.content
        );

        if (found) return found;
      }

      return {
        keyword,
        name: meta.name!,
        charset: meta.charset!,
        'http-equiv': meta.httpEquiv!,
        property: meta.property!,
        content: meta.content!,
      };
    });

    return calculatedMetas;
  }, [metas]);

  if (isServerSide && !hasMounted.current) {
    if (title) dispatcher._addToQueue(TITLE, title);

    (metas || []).forEach((meta) => {
      dispatcher._addToQueue(META, {
        keyword: 'charset',
        name: meta.name!,
        charset: meta.charset!,
        'http-equiv': meta.httpEquiv!,
        property: meta.property!,
        content: meta.content!,
      });
    });
  }

  useEffect(() => {
    if (prevMetas.current) {
      const previousMetas = [...prevMetas.current];
      const added: MetaPayload[] = [];

      memoizedMetas.forEach((meta) => {
        added.push(meta);
        if (previousMetas.includes(meta)) {
          previousMetas.splice(previousMetas.indexOf(meta), 1);
        } else {
          const previousIteration = previousMetas.find(
            (x) =>
              x.keyword === meta.keyword &&
              meta[meta.keyword] === x[meta.keyword]
          );
          if (previousIteration) {
            dispatcher._change(META, previousIteration, meta);
          } else {
            dispatcher._addToQueue(META, meta);
          }
        }
      });

      if (previousMetas.length) {
        previousMetas.forEach((meta) => {
          dispatcher._removeFromQueue(META, meta);
        });
      }

      addedMetas.current = added;
      prevMetas.current = memoizedMetas;
    }
  }, [...memoizedMetas]);

  useEffect(() => {
    memoizedMetas.forEach((meta) => {
      dispatcher._addToQueue(META, meta);
    });
    prevMetas.current = addedMetas.current = memoizedMetas;

    return () => {
      (addedMetas.current || []).forEach((meta) => {
        dispatcher._removeFromQueue(META, meta);
      });
    };
  }, []);

  useEffect(() => {
    if (hasMounted.current && title) {
      dispatcher._change(
        TITLE,
        prevTitle.current as string,
        (prevTitle.current = title)
      );
    }
  }, [title]);

  useEffect(() => {
    hasMounted.current = true;
    dispatcher._addToQueue(TITLE, (prevTitle.current = title!));

    return () => {
      hasMounted.current = false;
      dispatcher._removeFromQueue(TITLE, prevTitle.current as string);
    };
  }, []);
};
