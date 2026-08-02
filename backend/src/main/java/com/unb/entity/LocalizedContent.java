package com.unb.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

@Entity
@Table(name = "localized_contents")
public class LocalizedContent {

    @Id
    @Column(name = "content_key", nullable = false, length = 80)
    private String contentKey;

    @Column(name = "content_ko", columnDefinition = "TEXT", nullable = false)
    private String contentKo;

    @Column(name = "content_en", columnDefinition = "TEXT", nullable = false)
    private String contentEn;

    @Column(name = "content_ja", columnDefinition = "TEXT", nullable = false)
    private String contentJa;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public String getContentKey() { return contentKey; }
    public void setContentKey(String contentKey) { this.contentKey = contentKey; }
    public String getContentKo() { return contentKo; }
    public void setContentKo(String contentKo) { this.contentKo = contentKo; }
    public String getContentEn() { return contentEn; }
    public void setContentEn(String contentEn) { this.contentEn = contentEn; }
    public String getContentJa() { return contentJa; }
    public void setContentJa(String contentJa) { this.contentJa = contentJa; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
