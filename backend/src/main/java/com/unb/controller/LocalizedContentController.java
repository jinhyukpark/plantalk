package com.unb.controller;

import com.unb.service.LocalizedContentService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/content")
public class LocalizedContentController {
    private final LocalizedContentService service;

    public LocalizedContentController(LocalizedContentService service) {
        this.service = service;
    }

    @GetMapping("/usage-guide")
    public Map<String, Object> usageGuide(@RequestParam(defaultValue = "ko") String lang) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("key", LocalizedContentService.USAGE_GUIDE);
        result.put("language", lang);
        result.put("content", service.get(LocalizedContentService.USAGE_GUIDE, lang));
        return result;
    }
}
