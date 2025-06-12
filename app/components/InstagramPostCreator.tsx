@@  <!-- INSIDE the bar wrapper that contains the old “Frame 1 / Frame 2” buttons -->

-      {/* progress fill */}
-      <div
-        className="progress-inner"
-        style={{ width: `${progressRatio * 100}%` }}
-      />
+      {/* ── merged progress bar (only while playing) ── */}
+      {isPlaying && (
+        <div className="absolute inset-0 rounded-none overflow-hidden">
+          {/* grey base (same colour as buttons) */}
+          <div className="w-full h-full bg-gray-200" />
+
+          {/* black fill tracking the real animation progress */}
+          <div
+            className="absolute left-0 top-0 h-full bg-black"
+            style={{ width: `${Math.min(progressRatio * 100, 100)}%` }}
+          />
+        </div>
+      )}

@@  <!-- wrapper div for the two buttons -->
-<div className={`flex gap-2 gooey ${merged ? 'merge' : ''}`}>
+<div className={`relative flex gap-2 gooey ${isPlaying ? 'merge' : ''}`}>
