{/* …inside your left‐panel container… */}
<div
  ref={titleRef}
  className="absolute left-0 top-1/2 -translate-y-1/2"
>
  <div className="flex space-x-2">
    {/* ─── Title block (266px) ─── */}
    <div className="w-[266px] space-y-2">
      <FieldGroup step={1} label="Write a title">
        <Input
          value={titles[0]}
          onChange={e => setTitles([e.target.value, titles[1]])}
          className="h-9 w-full text-[15px] bg-gray-200 rounded-none focus:ring-0 focus:border-gray-300"
        />
        <Input
          value={titles[1]}
          onChange={e => setTitles([titles[0], e.target.value])}
          className="h-9 w-full text-[15px] bg-gray-200 rounded-none focus:ring-0 focus:border-gray-300"
        />
      </FieldGroup>
    </div>

    {/* ─── Instrument block (266px) ─── */}
    <div className="w-[266px] space-y-2">
      <FieldGroup step={2} label="Write the instrument">
        <Input
          value={subtitle}
          onChange={e => setSubtitle(e.target.value)}
          className="h-9 w-full text-[15px] bg-gray-200 rounded-none focus:ring-0 focus:border-gray-300"
        />
      </FieldGroup>
    </div>
  </div>
</div>
