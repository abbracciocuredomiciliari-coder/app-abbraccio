import React,{useEffect,useRef} from 'react';
import {mountHub} from './hub-ui.mjs';
import './hub.css';
import type {HubOptions,HubController} from './hub-ui.mjs';

/** Integrazione nel layout esistente. Collegare snapshot al servizio reale,
 * onViewChange al router/caricamento e onAction ai moduli già presenti.
 * NON fornire un intero archivio sanitario al client per filtrarlo localmente.
 */
export function HubConsegne(props:HubOptions){
 const element=useRef<HTMLDivElement>(null);
 const controller=useRef<HubController|null>(null);
 const callbacks=useRef(props);
 callbacks.current=props;
 useEffect(()=>{
   if(!element.current)return;
   controller.current=mountHub(element.current,{
     ...callbacks.current,
     onViewChange:view=>callbacks.current.onViewChange?.(view),
     onAction:action=>callbacks.current.onAction?.(action),
   });
   return ()=>{controller.current?.destroy();controller.current=null;};
 },[]);
 useEffect(()=>{controller.current?.update({snapshot:props.snapshot,...(props.view?{view:props.view}:{})});},[props.snapshot,props.view]);
 return <div ref={element}/>;
}
