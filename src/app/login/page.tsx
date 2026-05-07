"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

export default function LoginPage() {
    const router = useRouter()

    React.useEffect(() => {
        router.replace("/dashboard")
    }, [router])

    return null
}