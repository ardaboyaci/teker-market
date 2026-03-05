"use client"

import { useState } from "react"
import Image from "next/image"
import { PackageSearch, X, ZoomIn } from "lucide-react"

interface ProductImageGalleryProps {
    images: string[]
    productName: string
}

export function ProductImageGallery({ images, productName }: ProductImageGalleryProps) {
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [lightboxOpen, setLightboxOpen] = useState(false)

    const displayImages = images.length > 0 ? images : []
    const selectedImage = displayImages[selectedIndex]

    return (
        <>
            <div className="space-y-3">
                {/* Main Image */}
                <div
                    className="relative bg-white rounded-2xl border border-slate-200/60 overflow-hidden aspect-square flex items-center justify-center p-8 group cursor-zoom-in"
                    onClick={() => selectedImage && setLightboxOpen(true)}
                >
                    {selectedImage ? (
                        <>
                            <Image
                                src={selectedImage}
                                alt={productName}
                                width={600}
                                height={600}
                                className="w-full h-full object-contain mix-blend-multiply"
                                priority
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center">
                                <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-70 transition-opacity drop-shadow-lg" />
                            </div>
                        </>
                    ) : (
                        <PackageSearch className="w-20 h-20 text-slate-200" />
                    )}
                </div>

                {/* Thumbnail Strip */}
                {displayImages.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                        {displayImages.map((img, i) => (
                            <button
                                key={i}
                                onClick={() => setSelectedIndex(i)}
                                className={`flex-shrink-0 w-16 h-16 rounded-lg border-2 overflow-hidden transition-all ${i === selectedIndex
                                        ? "border-primary shadow-sm"
                                        : "border-slate-200 hover:border-slate-300"
                                    }`}
                            >
                                <Image
                                    src={img}
                                    alt={`${productName} - ${i + 1}`}
                                    width={64}
                                    height={64}
                                    className="w-full h-full object-contain mix-blend-multiply p-1"
                                />
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Lightbox */}
            {lightboxOpen && selectedImage && (
                <div
                    className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
                    onClick={() => setLightboxOpen(false)}
                >
                    <button
                        className="absolute top-4 right-4 p-2 text-white/70 hover:text-white transition-colors"
                        onClick={() => setLightboxOpen(false)}
                    >
                        <X className="w-6 h-6" />
                    </button>
                    <Image
                        src={selectedImage}
                        alt={productName}
                        width={1200}
                        height={1200}
                        className="max-w-full max-h-[90vh] object-contain"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </>
    )
}
