package com.unb.repository;

import com.unb.entity.BlockedUser;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface BlockedUserRepository extends JpaRepository<BlockedUser, UUID> {
    
    List<BlockedUser> findByBlockerId(UUID blockerId);
    
    Optional<BlockedUser> findByBlockerIdAndBlockedId(UUID blockerId, UUID blockedId);
    
    boolean existsByBlockerIdAndBlockedId(UUID blockerId, UUID blockedId);
    
    void deleteByBlockerIdAndBlockedId(UUID blockerId, UUID blockedId);
}
