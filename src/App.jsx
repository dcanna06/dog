import { useState } from 'react'
import './App.css'

const SOUNDS = ['Woof!', 'Bark bark!', 'Arf!', 'Bork!', 'Yip!']

export default function App() {
  const [sound, setSound] = useState('Woof!')
  const [count, setCount] = useState(0)

  const pet = () => {
    setSound(SOUNDS[Math.floor(Math.random() * SOUNDS.length)])
    setCount((c) => c + 1)
  }

  return (
    <main className="app">
      <h1>🐕 Dog</h1>
      <p className="sound">{sound}</p>
      <button onClick={pet}>Pet the dog</button>
      <p className="count">Pets: {count}</p>
    </main>
  )
}
