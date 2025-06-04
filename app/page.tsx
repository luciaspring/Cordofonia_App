import dynamic from 'next/dynamic'

const InstagramPostCreator = dynamic(() => import('./components/InstagramPostCreator'), { ssr: false })

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <InstagramPostCreator />
    </main>
  )
}