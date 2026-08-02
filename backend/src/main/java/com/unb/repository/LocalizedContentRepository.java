package com.unb.repository;

import com.unb.entity.LocalizedContent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface LocalizedContentRepository extends JpaRepository<LocalizedContent, String> {
}
