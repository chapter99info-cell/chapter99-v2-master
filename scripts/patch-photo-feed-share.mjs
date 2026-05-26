/**
 * Add share-caption copy to PhotoFeedFull.jsx lightbox (idempotent).
 */
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const file = join(root, 'src', 'pages', 'PhotoFeedFull.jsx')

if (!existsSync(file)) {
  console.error('Missing', file)
  process.exit(1)
}

let s = readFileSync(file, 'utf8')

if (s.includes('buildGalleryShareCaption')) {
  console.log('Already patched')
  process.exit(0)
}

if (!s.startsWith('import { useState }')) {
  console.error('Unexpected file header')
  process.exit(1)
}

s = s.replace(
  'import { useState } from "react";',
  `import { useState } from "react";
import { buildGalleryShareCaption } from "../lib/galleryShareCaption";`,
)

s = s.replace(
  'const [sel, setSel]       = useState(null);',
  `const [sel, setSel]       = useState(null);
  const [captionCopied, setCaptionCopied] = useState(false);`,
)

const copyFn = `
  const copyShareCaption = async (photo, countryLabel) => {
    const text = buildGalleryShareCaption(photo, countryLabel);
    try {
      await navigator.clipboard.writeText(text);
      setCaptionCopied(true);
      setTimeout(() => setCaptionCopied(false), 2000);
    } catch {
      window.prompt("Copy caption:", text);
    }
  };
`

s = s.replace(
  'const filtered = filter === "ALL"',
  `${copyFn}
  const filtered = filter === "ALL"`,
)

const oldBlock = `              <div style={{borderTop:"1px solid rgba(255,255,255,0.07)",paddingTop:"12px"}}>
                <p style={{fontSize:"10px",color:"rgba(255,255,255,0.25)",textTransform:"uppercase",letterSpacing:"0.1em",margin:"0 0 8px",fontWeight:500}}>Camera Settings</p>
                <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
                  {sel.settings.split(" · ").map((s,i) => (
                    <span key={i} style={{
                      padding:"4px 10px",borderRadius:"6px",
                      background:"rgba(255,255,255,0.06)",
                      border:"1px solid rgba(255,255,255,0.1)",
                      fontSize:"11px",fontWeight:500,
                      color:"rgba(255,255,255,0.65)",
                      fontFamily:"ui-monospace,monospace",
                    }}>{s}</span>
                  ))}
                </div>
              </div>`

const newBlock = `              <div style={{borderTop:"1px solid rgba(255,255,255,0.07)",paddingTop:"12px"}}>
                <p style={{fontSize:"10px",color:"rgba(255,255,255,0.25)",textTransform:"uppercase",letterSpacing:"0.1em",margin:"0 0 8px",fontWeight:500}}>Camera Settings</p>
                <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
                  {sel.settings.split(" · ").map((s,i) => (
                    <span key={i} style={{
                      padding:"4px 10px",borderRadius:"6px",
                      background:"rgba(255,255,255,0.06)",
                      border:"1px solid rgba(255,255,255,0.1)",
                      fontSize:"11px",fontWeight:500,
                      color:"rgba(255,255,255,0.65)",
                      fontFamily:"ui-monospace,monospace",
                    }}>{s}</span>
                  ))}
                </div>
              </div>

              <div style={{borderTop:"1px solid rgba(255,255,255,0.07)",paddingTop:"12px",marginTop:"12px"}}>
                <p style={{fontSize:"10px",color:"rgba(255,255,255,0.25)",textTransform:"uppercase",letterSpacing:"0.1em",margin:"0 0 8px",fontWeight:500}}>Share caption</p>
                <pre style={{
                  margin:"0 0 10px",padding:"10px 12px",borderRadius:"10px",
                  background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",
                  fontSize:"11px",lineHeight:1.45,whiteSpace:"pre-wrap",wordBreak:"break-word",
                  color:"rgba(255,255,255,0.7)",fontFamily:"inherit",
                }}>{buildGalleryShareCaption(sel, dm.label)}</pre>
                <button type="button" onClick={(e)=>{e.stopPropagation();copyShareCaption(sel,dm.label);}} style={{
                  width:"100%",padding:"10px",borderRadius:"10px",border:"none",cursor:"pointer",
                  background: captionCopied ? "rgba(0,135,90,0.9)" : dm.color,
                  color:"#fff",fontSize:"12px",fontWeight:600,fontFamily:"inherit",
                  boxShadow:\`0 2px 12px \${dm.shadow}\`,
                }}>{captionCopied ? "Copied ✓" : "Copy caption for FB / IG"}</button>
              </div>`

if (!s.includes(oldBlock)) {
  console.error('Lightbox block not found — file may have changed')
  process.exit(1)
}

s = s.replace(oldBlock, newBlock)
writeFileSync(file, s)
console.log('Patched', file)
