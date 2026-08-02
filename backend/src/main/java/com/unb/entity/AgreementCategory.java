package com.unb.entity;

public enum AgreementCategory {
    ROMANCE("romance", "💕", "로맨스"),
    GATHERING("gathering", "🎉", "모임"),
    WEDDING("wedding", "💒", "결혼"),
    PROTEST("protest", "📢", "집회"),
    STUDY("study", "📚", "스터디"),
    PROMISE("promise", "🤝", "약속"),
    SPORTS("sports", "⚽", "운동"),
    CUSTOM("custom", "✨", "사용자 지정");

    private final String code;
    private final String emoji;
    private final String label;

    AgreementCategory(String code, String emoji, String label) {
        this.code = code;
        this.emoji = emoji;
        this.label = label;
    }

    public String getCode() { return code; }
    public String getEmoji() { return emoji; }
    public String getLabel() { return label; }
}
