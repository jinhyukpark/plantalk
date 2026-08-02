package com.unb.repository;

import com.unb.entity.UserPhoto;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface UserPhotoRepository extends JpaRepository<UserPhoto, UUID> {
    List<UserPhoto> findByUserIdOrderByDisplayOrderAscCreatedAtDesc(UUID userId);
    int countByUserId(UUID userId);
    void deleteByIdAndUserId(UUID id, UUID userId);
}
