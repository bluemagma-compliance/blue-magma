"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";

export function TranslucentHeader() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? "bg-slate-900/95 backdrop-blur-md" : "bg-transparent"
      }`}
    >
      <div className="container mx-auto px-4 py-2">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link href="/" className="flex flex-col items-start">
            <Image
              src="/logos/pngs/16 White Horizontal.png"
              alt="Blue Magma"
              width={240}
              height={60}
              priority
              className="h-14 w-auto"
            />
            <span className="text-white/70 text-xs font-light tracking-wider mt-1 self-end">
              scan. deploy. comply
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link
              href="/"
              className="text-white/90 hover:text-white transition-colors font-medium"
            >
              Home
            </Link>
            <Link
              href="/contact"
              className="text-white/90 hover:text-white transition-colors font-medium"
            >
              Contact
            </Link>
            <Button
              asChild
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium"
            >
              <Link href="/login">Get Started</Link>
            </Button>
          </nav>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden text-white p-2"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-slate-900/95 backdrop-blur-md border-t border-white/10">
            <nav className="flex flex-col space-y-4 p-4">
              <Link
                href="/"
                className="text-white/90 hover:text-white transition-colors font-medium py-2"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Home
              </Link>
              <Link
                href="/contact"
                className="text-white/90 hover:text-white transition-colors font-medium py-2"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Contact
              </Link>
              <Button
                asChild
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium w-fit"
              >
                <Link href="/login">Get Started</Link>
              </Button>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
