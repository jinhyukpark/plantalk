package com.unb.service;

import com.unb.entity.LocalizedContent;
import com.unb.repository.LocalizedContentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

@Service
public class LocalizedContentService {
    public static final String USAGE_GUIDE = "usage-guide";

    private static final String DEFAULT_KO =
        "플랜톡은 사람들 간의 상호 동의와 약속을 기록하는 도구입니다. 이 앱은 법적 계약을 제공하지 않으며, 전문적인 법률 자문을 대체할 수 없습니다.";
    private static final String DEFAULT_EN =
        "PlanTalk is a tool for recording mutual agreements and promises between people. It does not provide legal contracts or replace professional legal advice.";
    private static final String DEFAULT_JA =
        "PlanTalkは、人と人との相互の同意や約束を記録するためのツールです。法的契約を提供するものではなく、専門的な法律相談に代わるものではありません。";

    private final LocalizedContentRepository repository;

    public LocalizedContentService(LocalizedContentRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getAll(String key) {
        LocalizedContent item = repository.findById(key).orElse(null);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("key", key);
        result.put("ko", item == null ? DEFAULT_KO : item.getContentKo());
        result.put("en", item == null ? DEFAULT_EN : item.getContentEn());
        result.put("ja", item == null ? DEFAULT_JA : item.getContentJa());
        result.put("updatedAt", item == null ? null : item.getUpdatedAt());
        return result;
    }

    @Transactional(readOnly = true)
    public String get(String key, String language) {
        Map<String, Object> all = getAll(key);
        String normalized = language == null ? "ko" : language.toLowerCase(Locale.ROOT);
        if (!normalized.equals("en") && !normalized.equals("ja")) normalized = "ko";
        return String.valueOf(all.get(normalized));
    }

    @Transactional
    public Map<String, Object> updateUsageGuide(Map<String, String> request) {
        String ko = required(request.get("ko"), "한국어");
        String en = required(request.get("en"), "영어");
        String ja = required(request.get("ja"), "일본어");
        LocalizedContent item = repository.findById(USAGE_GUIDE).orElseGet(LocalizedContent::new);
        item.setContentKey(USAGE_GUIDE);
        item.setContentKo(ko);
        item.setContentEn(en);
        item.setContentJa(ja);
        repository.save(item);
        return getAll(USAGE_GUIDE);
    }

    private String required(String value, String label) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(label + " 내용을 입력해 주세요.");
        }
        return value.trim();
    }
}
