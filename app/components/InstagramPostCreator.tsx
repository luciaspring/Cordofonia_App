--- a/app/components/InstagramPostCreator.tsx
+++ b/app/components/InstagramPostCreator.tsx
@@ const drawCanvas = (progress: number = 0) => {
-    if (isPlaying) {
-      const frame1Lines = lines.filter(l => l.frame === 1)
-      const frame2Lines = lines.filter(l => l.frame === 2)
-
-      if (progress <= 0.3) {
-        drawStaticText(ctx, 1)
-        drawAnimatedLines(ctx, progress / 0.3, frame1Lines, [], 'grow')
-      } else if (progress <= 0.6) {
-        drawStaticText(ctx, 1)
-        drawAnimatedLines(ctx, (progress - 0.3) / 0.3, frame1Lines, [], 'shrink')
-      } else if (progress <= 0.7) {
-        const t = (progress - 0.6) / 0.1
-        drawAnimatedText(ctx, t, 0, 1, 2)
-      } else if (progress <= 1.0) {
-        drawStaticText(ctx, 2)
-        drawAnimatedLines(ctx, (progress - 0.7) / 0.3, [], frame2Lines, 'grow')
-      } else if (progress <= 1.3) {
-        drawStaticText(ctx, 2)
-        drawAnimatedLines(ctx, (progress - 1.0) / 0.3, [], frame2Lines, 'shrink')
-      } else if (progress <= 1.4) {
-        const t = (progress - 1.3) / 0.1
-        drawAnimatedText(ctx, t, 1, 2, 1)
-      }
-      return
-    }
+    if (isPlaying) {
+      // use our unified move→pause→scale sequence
+      drawAnimatedContent(ctx, progress)
+      return
+    }