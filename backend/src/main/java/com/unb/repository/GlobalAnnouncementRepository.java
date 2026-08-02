package com.unb.repository;

import com.unb.entity.GlobalAnnouncement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface GlobalAnnouncementRepository extends JpaRepository<GlobalAnnouncement, String> {
    List<GlobalAnnouncement> findAllByOrderByCreatedAtDesc();
}
