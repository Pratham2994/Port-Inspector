import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";

interface TipRequest {
  text: string;
  el: HTMLElement | SVGElement;
}

interface Coords {
  x: number;
  y: number;
  below: boolean;
}

const Ctx = createContext<{ show: (r: TipRequest) => void; hide: () => void }>({
  show: () => {},
  hide: () => {},
});

type TipHandlers = {
  onMouseEnter: (e: React.MouseEvent<HTMLElement | SVGElement>) => void;
  onMouseLeave: () => void;
  onFocus: (e: React.FocusEvent<HTMLElement | SVGElement>) => void;
  onBlur: () => void;
};

/** Hover and focus tooltip props for any element, HTML or SVG. */
export function useTip() {
  const api = useContext(Ctx);
  return useMemo(() => {
    const forText = (text: string): TipHandlers => ({
      onMouseEnter: (e) => api.show({ text, el: e.currentTarget }),
      onMouseLeave: api.hide,
      onFocus: (e) => api.show({ text, el: e.currentTarget }),
      onBlur: api.hide,
    });
    return { for: forText, show: api.show, hide: api.hide };
  }, [api]);
}

/**
 * Renders every tooltip in one fixed-position layer at the app root, so no
 * scroll container can clip it and no window edge can cut it. Flips below
 * the target when there is no room above.
 */
export function TipProvider({ children }: { children: ReactNode }) {
  const [req, setReq] = useState<TipRequest | null>(null);
  const [pos, setPos] = useState<Coords | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const show = useCallback((r: TipRequest) => {
    setPos(null);
    setReq(r);
  }, []);
  const hide = useCallback(() => {
    setReq(null);
    setPos(null);
  }, []);

  useLayoutEffect(() => {
    if (!req || pos || !boxRef.current) return;
    const t = req.el.getBoundingClientRect();
    const b = boxRef.current.getBoundingClientRect();
    const below = t.top < b.height + 86;
    const x = Math.min(Math.max(8, t.left), window.innerWidth - b.width - 8);
    let y = below ? t.bottom + 9 : t.top - b.height - 9;
    let flipped = below;
    if (y < 8) {
      y = t.bottom + 9;
      flipped = true;
    }
    setPos({ x, y, below: flipped });
  });

  useLayoutEffect(() => {
    if (!req) return;
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, [req, hide]);

  return (
    <Ctx.Provider value={{ show, hide }}>
      {children}
      <div
        ref={boxRef}
        className={`tooltip${pos ? " show" : ""}${pos?.below ? " below" : ""}`}
        style={pos ? { left: pos.x, top: pos.y } : { visibility: "hidden" }}
        role="tooltip"
      >
        {req?.text}
      </div>
    </Ctx.Provider>
  );
}
