import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

// Simple profanity masking for chat messages.
// Keeps the first character and replaces the rest with '*', e.g. "fuck" -> "f***".
// NOTE: "bullshit" is intentionally not included in this list.
const PROFANITY_WORDS = [
	"fuck",
	"fucking",
	"fucked",
	"motherfucker",
	"shit",
	"shitty",
	"bitch",
	"bitches",
	"asshole",
	"dick",
	"cunt",
	"bastard",
];

const PROFANITY_REGEX = new RegExp(`\\b(${PROFANITY_WORDS.join("|")})\\b`, "gi");

export function maskProfanity(text: string): string {
	return text.replace(PROFANITY_REGEX, (match) => {
		if (match.length <= 1) return "*";
		const firstChar = match[0];
		const maskedRest = "*".repeat(match.length - 1);
		return `${firstChar}${maskedRest}`;
	});
}
