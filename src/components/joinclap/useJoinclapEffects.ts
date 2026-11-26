"use client"

import { useEffect } from "react"

export function useJoinclapEffects() {
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    const yearEl = document.getElementById("year")
    if (yearEl) yearEl.textContent = String(new Date().getFullYear())

    const revealItems = document.querySelectorAll(".reveal")
    let io: IntersectionObserver | null = null
    if ("IntersectionObserver" in window && !reduce) {
      io = new IntersectionObserver(
        (entries) =>
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("visible")
              io?.unobserve(entry.target)
            }
          }),
        { threshold: 0.12 }
      )
      revealItems.forEach((el) => io?.observe(el))
    } else {
      revealItems.forEach((el) => el.classList.add("visible"))
    }

    const hero = document.querySelector<HTMLElement>(".hero")
    const dash = document.querySelector<HTMLElement>(".dashboard")
    const cards = Array.from(document.querySelectorAll<HTMLElement>(".feature-card"))
    const photo = document.querySelector<HTMLElement>(".parallax")
    let ticking = false

    const onScroll = () => {
      const y = window.scrollY || 0
      if (!reduce && hero) {
        if (y < window.innerHeight * 1.1) {
          const p = Math.min(1, y / (window.innerHeight * 0.9))
          hero.style.setProperty("--scroll-progress", String(p))
          const title = hero.querySelector("h1")
          if (title) {
            title.style.transform = `translate3d(0,${p * -34}px,0)`
            title.style.letterSpacing = `${-0.085 - p * 0.018}em`
          }
          if (dash) dash.style.transform = `translate3d(0,${p * 34}px,0) rotateY(${-9 + p * 9}deg) rotateX(${4 - p * 4}deg) scale(${1 + p * 0.035})`
        }
      }
      if (photo && photo.parentElement) {
        const r = photo.parentElement.getBoundingClientRect()
        if (r.top < innerHeight && r.bottom > 0) photo.style.transform = `translateY(${(r.top - innerHeight) * -0.075}px)`
      }
      ticking = false
    }

    const onScrollTick = () => {
      if (!ticking) {
        requestAnimationFrame(onScroll)
        ticking = true
      }
    }
    window.addEventListener("scroll", onScrollTick, { passive: true })
    onScroll()

    const stack = document.querySelector<HTMLElement>(".feature-stack")
    let removeStackListener: (() => void) | null = null
    if (!reduce && stack && window.matchMedia("(min-width: 901px)").matches) {
      const onStackScroll = () => {
        const rect = stack.getBoundingClientRect()
        const progress = Math.max(0, Math.min(1, (innerHeight * 0.78 - rect.top) / (rect.height + innerHeight * 0.3)))
        cards.forEach((card, i) => {
          const local = Math.max(0, Math.min(1, progress * cards.length - i))
          card.style.transform = `perspective(1000px) rotateX(${(1 - local) * -5}deg) scale(${1 - (1 - local) * 0.025})`
        })
      }
      window.addEventListener("scroll", onStackScroll, { passive: true })
      removeStackListener = () => window.removeEventListener("scroll", onStackScroll)
    }

    const scene = document.querySelector<HTMLElement>(".hero-3d-scene")
    const heroContainer = document.querySelector<HTMLElement>(".hero")
    let removeSceneListeners: (() => void) | null = null
    if (scene && heroContainer && !reduce && window.matchMedia("(pointer: fine)").matches) {
      const onMove = (e: PointerEvent) => {
        const r = scene.getBoundingClientRect()
        const px = (e.clientX - r.left) / r.width - 0.5
        const py = (e.clientY - r.top) / r.height - 0.5
        scene.style.transform = `rotateY(${px * 7}deg) rotateX(${-py * 6}deg)`
        if (dash) dash.style.translate = `${px * -9}px ${py * -7}px`
      }
      const onLeave = () => {
        scene.style.transform = ""
        if (dash) dash.style.translate = ""
      }
      heroContainer.addEventListener("pointermove", onMove)
      heroContainer.addEventListener("pointerleave", onLeave)
      removeSceneListeners = () => {
        heroContainer.removeEventListener("pointermove", onMove)
        heroContainer.removeEventListener("pointerleave", onLeave)
      }
    }

    const removeMagneticListeners: (() => void)[] = []
    document.querySelectorAll(".magnetic").forEach((el) => {
      const node = el as HTMLElement
      const onMove = (e: MouseEvent) => {
        if (window.innerWidth < 800 || reduce) return
        const r = node.getBoundingClientRect()
        const x = e.clientX - r.left - r.width / 2
        const y = e.clientY - r.top - r.height / 2
        node.style.transform = `translate(${x * 0.12}px,${y * 0.16}px)`
      }
      const onLeave = () => {
        node.style.transform = ""
      }
      node.addEventListener("mousemove", onMove)
      node.addEventListener("mouseleave", onLeave)
      removeMagneticListeners.push(() => {
        node.removeEventListener("mousemove", onMove)
        node.removeEventListener("mouseleave", onLeave)
      })
    })

    return () => {
      window.removeEventListener("scroll", onScrollTick)
      io?.disconnect()
      removeStackListener?.()
      removeSceneListeners?.()
      removeMagneticListeners.forEach((fn) => fn())
    }
  }, [])
}
